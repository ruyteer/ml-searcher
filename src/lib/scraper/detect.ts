/// Motor de detecção de oferta: dado o preço atual e o histórico, decide se
/// a queda é relevante o bastante para virar uma Offer.

import { discountPct } from "../format";

export type ReferenceKind = "ML_ORIGINAL" | "HISTORY_AVG" | "HISTORY_MIN";

export type RejectReason =
  | "BLOCKED"
  | "BELOW_MIN_PRICE"
  | "LOW_SOLD"
  | "NO_REFERENCE"
  | "BELOW_MIN_DISCOUNT";

/// Só o que o detector precisa saber do produto — serve tanto para o
/// NormalizedProduct vindo da API quanto para a linha já gravada no banco.
export interface DetectProduct {
  mlId?: string;
  /// Preço atual, em centavos.
  price: number;
  /// "De" do ML, em centavos. null quando não existe ou não é maior que o preço.
  originalPrice?: number | null;
  soldQuantity?: number;
  sellerStatus?: string | null;
  freeShipping?: boolean;
  officialStore?: boolean;
  blocked?: boolean;
}

export interface PricePoint {
  price: number;
  capturedAt: Date;
}

export interface DetectSettings {
  minDiscount: number;
  minPrice: number;
  minSoldQuantity: number;
  minHistoryPoints: number;
  hotDiscount?: number;
}

export interface DetectInput {
  product: DetectProduct;
  /// Pontos de preço já gravados, SEM a captura atual.
  history?: PricePoint[];
  settings: DetectSettings;
  /// Desconto mínimo específico da watch, quando definido.
  watchMinDiscount?: number | null;
  /// Menor preço de TODO o histórico, em centavos. Quando informado prevalece
  /// sobre o mínimo da janela de 30 dias — só influencia o score.
  historyMin?: number | null;
  now?: Date;
}

export interface OfferDetected {
  isOffer: true;
  referencePrice: number;
  referenceKind: ReferenceKind;
  discountPct: number;
  score: number;
  hot: boolean;
}

export interface NoOffer {
  isOffer: false;
  reason: RejectReason;
  /// Texto pronto para a linha de log do painel.
  message: string;
}

export type DetectResult = OfferDetected | NoOffer;

const HISTORY_WINDOW_DAYS = 30;

// ------------------------------------------------------------------- score
//
// Pesos (somam 100):
//   50  desconto %      — satura em 60% de desconto
//   14  reputação       — platinum 14 / gold 10 / silver 6 / outros 3 / sem 0
//   14  vendas          — escala log, satura em 1000 vendas
//    7  frete grátis
//    7  loja oficial
//    8  menor preço já registrado no histórico
const W_DISCOUNT = 50;
const W_REPUTATION = 14;
const W_SOLD = 14;
const W_FREE_SHIPPING = 7;
const W_OFFICIAL = 7;
const W_HISTORY_MIN = 8;

const DISCOUNT_SATURATION = 60;
const SOLD_SATURATION = 1000;

function reputationPoints(status: string | null | undefined): number {
  switch ((status ?? "").toLowerCase()) {
    case "platinum":
      return W_REPUTATION;
    case "gold":
      return 10;
    case "silver":
      return 6;
    case "":
      return 0;
    default:
      return 3;
  }
}

function soldPoints(sold: number): number {
  if (sold <= 0) return 0;
  const ratio = Math.log10(sold + 1) / Math.log10(SOLD_SATURATION + 1);
  return Math.min(1, ratio) * W_SOLD;
}

export interface ScoreInput {
  discount: number;
  product: DetectProduct;
  /// Menor preço já registrado, quando conhecido (em centavos).
  historyMin?: number | null;
}

/// 0-100. Combina o tamanho do desconto com sinais de qualidade do anúncio.
export function scoreOffer({ discount, product, historyMin }: ScoreInput): number {
  let score = Math.min(1, Math.max(0, discount) / DISCOUNT_SATURATION) * W_DISCOUNT;
  score += reputationPoints(product.sellerStatus);
  score += soldPoints(product.soldQuantity ?? 0);
  if (product.freeShipping) score += W_FREE_SHIPPING;
  if (product.officialStore) score += W_OFFICIAL;
  // HISTORY_MIN nunca é referência principal — só reforça o score quando o
  // preço atual empata ou bate o menor já visto.
  if (typeof historyMin === "number" && historyMin > 0 && product.price <= historyMin) {
    score += W_HISTORY_MIN;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

// --------------------------------------------------------------- referência

export interface Reference {
  price: number;
  kind: ReferenceKind;
}

export interface HistoryStats {
  /// Média dos últimos 30 dias, em centavos. null se não houver pontos suficientes.
  average: number | null;
  /// Quantidade de pontos na janela.
  points: number;
  /// Menor preço de todo o histórico fornecido.
  min: number | null;
}

export function summarizeHistory(
  history: PricePoint[] | undefined,
  now: Date = new Date(),
): HistoryStats {
  if (!history || history.length === 0) return { average: null, points: 0, min: null };

  const cutoff = now.getTime() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  let sum = 0;
  let points = 0;
  let min: number | null = null;

  for (const point of history) {
    if (!Number.isFinite(point.price) || point.price <= 0) continue;
    if (min === null || point.price < min) min = point.price;
    if (point.capturedAt.getTime() >= cutoff) {
      sum += point.price;
      points += 1;
    }
  }

  return { average: points > 0 ? Math.round(sum / points) : null, points, min };
}

/// Ordem de preferência: original_price do ML, depois a média do histórico.
function pickReference(
  product: DetectProduct,
  stats: HistoryStats,
  minHistoryPoints: number,
): Reference | null {
  const original = product.originalPrice;
  if (typeof original === "number" && original > product.price) {
    return { price: original, kind: "ML_ORIGINAL" };
  }
  if (stats.average !== null && stats.points >= minHistoryPoints && stats.average > product.price) {
    return { price: stats.average, kind: "HISTORY_AVG" };
  }
  return null;
}

// ---------------------------------------------------------------- detecção

export function detect(input: DetectInput): DetectResult {
  const { product, settings } = input;
  const now = input.now ?? new Date();

  if (product.blocked) {
    return { isOffer: false, reason: "BLOCKED", message: "Produto bloqueado." };
  }

  if (product.price < settings.minPrice) {
    return {
      isOffer: false,
      reason: "BELOW_MIN_PRICE",
      message: `Preço abaixo do mínimo configurado (${product.price} < ${settings.minPrice} centavos).`,
    };
  }

  const sold = product.soldQuantity ?? 0;
  if (sold < settings.minSoldQuantity) {
    return {
      isOffer: false,
      reason: "LOW_SOLD",
      message: `Vendas insuficientes (${sold} < ${settings.minSoldQuantity}).`,
    };
  }

  const stats = summarizeHistory(input.history, now);
  const reference = pickReference(product, stats, settings.minHistoryPoints);

  if (!reference) {
    return {
      isOffer: false,
      reason: "NO_REFERENCE",
      message:
        stats.points > 0
          ? `Sem referência de preço: ${stats.points} ponto(s) no histórico, mínimo ${settings.minHistoryPoints}.`
          : "Sem referência de preço: produto novo e sem 'de' declarado pelo ML.",
    };
  }

  const discount = discountPct(product.price, reference.price);
  const threshold =
    typeof input.watchMinDiscount === "number" && input.watchMinDiscount > 0
      ? input.watchMinDiscount
      : settings.minDiscount;

  if (discount < threshold) {
    return {
      isOffer: false,
      reason: "BELOW_MIN_DISCOUNT",
      message: `Desconto de ${discount}% abaixo do mínimo de ${threshold}%.`,
    };
  }

  const score = scoreOffer({ discount, product, historyMin: input.historyMin ?? stats.min });
  const hotDiscount = settings.hotDiscount ?? Number.POSITIVE_INFINITY;

  return {
    isOffer: true,
    referencePrice: reference.price,
    referenceKind: reference.kind,
    discountPct: discount,
    score,
    hot: discount >= hotDiscount,
  };
}
