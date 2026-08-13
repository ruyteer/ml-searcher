/// Regra de visibilidade das ofertas: quais das ofertas já guardadas a
/// configuração ATUAL deixa aparecer.
///
/// Por que aqui, e não numa coluna materializada como `Product.hiddenByWords`:
///
///   - o filtro por palavras precisa rodar expressão regular sobre o título,
///     um texto livre. Isso é caro e não entra em índice, então compensa
///     decidir uma vez e guardar o resultado num booleano;
///   - a detecção compara NÚMEROS que já estão na própria linha
///     (`discountPct`, `price`) ou na linha do produto (`soldQuantity`). Um
///     booleano seria só uma cópia dessa comparação, e uma cópia que envelhece:
///     `soldQuantity` muda a cada varredura, então a coluna já nasceria errada
///     entre uma mudança de configuração e outra. Comparar na hora nunca
///     desatualiza e não precisa de migration.
///
/// A `Offer` continua sendo um registro histórico intacto: nada é apagado nem
/// reescrito. Ela guarda o desconto do dia em que foi detectada; esta regra só
/// decide se ela aparece hoje. Baixar o desconto mínimo faz tudo voltar.
///
/// Este módulo é puro de propósito (só tipos do Prisma, nenhum client, nenhum
/// "server-only"): é ele que garante que a LISTA e os CONTADORES usem exatamente
/// a mesma condição, que era de onde vinham os números que não batiam.

import type { Prisma } from "@/generated/prisma";

// ------------------------------------------------------------------- a regra

export interface OfferVisibility {
  /// Desconto mínimo (%) para a oferta aparecer.
  minDiscount: number;
  /// Preço mínimo (centavos) da oferta para ela aparecer.
  minPrice: number;
  /// Vendas mínimas do produto para as ofertas dele aparecerem.
  minSoldQuantity: number;
  /// A partir daqui a oferta é destacada como imperdível.
  hotDiscount: number;
}

/// Sem nenhuma restrição: usada para contar o universo total de ofertas.
export const VISIBILIDADE_ABERTA: OfferVisibility = {
  minDiscount: 0,
  minPrice: 0,
  minSoldQuantity: 0,
  hotDiscount: 0,
};

function inteiro(valor: unknown, min: number, max: number): number {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/// Aceita valores vindos do banco ou de um formulário ainda não salvo e devolve
/// a regra já saneada. Ter um ponto único evita que a prévia e o valor salvo
/// discordem por causa de um campo vazio ou fora de faixa.
export function normalizeVisibility(raw: Partial<OfferVisibility>): OfferVisibility {
  return {
    minDiscount: inteiro(raw.minDiscount ?? 0, 0, 100),
    minPrice: inteiro(raw.minPrice ?? 0, 0, 99_999_900),
    minSoldQuantity: inteiro(raw.minSoldQuantity ?? 0, 0, 1_000_000),
    hotDiscount: inteiro(raw.hotDiscount ?? 0, 0, 100),
  };
}

/// `minHistoryPoints` de propósito NÃO entra na regra: ele decide se o
/// histórico serve de referência de preço no momento da detecção, e o histórico
/// só cresce. Reaplicá-lo agora usaria um histórico maior do que o daquele dia,
/// então praticamente nada mudaria de lugar e a consulta ganharia um agregado
/// por linha sem necessidade. Ele continua valendo na próxima varredura.

// -------------------------------------------------------------- consulta

/// Um piso `gte` que não atropela um teto `lte` já existente. Quando já havia
/// um piso, vence o mais restritivo: a configuração é o mínimo garantido e o
/// filtro da tela só consegue estreitar mais.
function comPiso(atual: unknown, piso: number): { gte: number; lte?: number } {
  const filtro = atual && typeof atual === "object" ? (atual as { gte?: unknown; lte?: unknown }) : {};
  const gte = typeof filtro.gte === "number" ? Math.max(filtro.gte, piso) : piso;
  const lte = typeof filtro.lte === "number" ? filtro.lte : undefined;
  return lte === undefined ? { gte } : { gte, lte };
}

export interface OfferWhereParts {
  /// Condições que a tela pediu sobre a própria oferta (situação, faixa de preço...).
  offer?: Prisma.OfferWhereInput;
  /// Condições sobre o produto (filtro por palavras, categoria, busca...).
  product?: Prisma.ProductWhereInput;
}

/// O `where` completo das ofertas que devem aparecer: junta o que a tela pediu
/// com o que a configuração permite.
///
/// Use SEMPRE esta função, tanto para listar quanto para contar. É o que
/// garante que o número do topo da tela bata com a lista de baixo.
export function ofertasVisiveisWhere(
  visibility: OfferVisibility,
  parts: OfferWhereParts = {},
): Prisma.OfferWhereInput {
  const where: Prisma.OfferWhereInput = { ...parts.offer };

  if (visibility.minDiscount > 0) {
    where.discountPct = comPiso(where.discountPct, visibility.minDiscount);
  }
  if (visibility.minPrice > 0) {
    where.price = comPiso(where.price, visibility.minPrice);
  }

  const product: Prisma.ProductWhereInput = { ...parts.product };
  if (visibility.minSoldQuantity > 0) {
    product.soldQuantity = comPiso(product.soldQuantity, visibility.minSoldQuantity);
  }
  if (Object.keys(product).length > 0) where.product = product;

  return where;
}

/// As visíveis que ainda por cima batem o desconto de "imperdível". É a mesma
/// regra com o piso de desconto elevado, então uma imperdível é sempre um
/// subconjunto das visíveis (nunca aparece um destaque de uma oferta escondida).
export function ofertasImperdiveisWhere(
  visibility: OfferVisibility,
  parts: OfferWhereParts = {},
): Prisma.OfferWhereInput {
  if (visibility.hotDiscount <= 0) return ofertasVisiveisWhere(visibility, parts);
  return ofertasVisiveisWhere(
    { ...visibility, minDiscount: Math.max(visibility.minDiscount, visibility.hotDiscount) },
    parts,
  );
}

/// Esta oferta é destaque de imperdível com a configuração atual? Decidido
/// sempre pelo valor configurado HOJE, nunca pelo do dia da detecção.
export function ofertaImperdivel(discountPct: number, visibility: OfferVisibility): boolean {
  return visibility.hotDiscount > 0 && discountPct >= visibility.hotDiscount;
}

/// Identidade da regra, para entrar na chave do cache das consultas: mudou a
/// configuração, muda a chave, e nenhuma tela serve o recorte antigo.
export function visibilityKey(visibility: OfferVisibility): string {
  return [
    visibility.minDiscount,
    visibility.minPrice,
    visibility.minSoldQuantity,
    visibility.hotDiscount,
  ].join("|");
}
