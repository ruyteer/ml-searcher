import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { TAGS } from "@/lib/cache";
import { tituloEscondidoSql, type ImpactoDoFiltro } from "@/lib/data/products";
import type { WordFilter } from "@/lib/word-filter";
import {
  normalizeVisibility,
  ofertasImperdiveisWhere,
  ofertasVisiveisWhere,
  visibilityKey,
  VISIBILIDADE_ABERTA,
  type OfferVisibility,
} from "@/lib/offer-visibility";
import { OfferStatus, Prisma } from "@/generated/prisma";

// ------------------------------------------------------------------ tipos

export type OfferSort = "score" | "discount" | "price" | "recent";
export type OfferStatusFilter = OfferStatus | "ALL";

export interface OfferFilters {
  status: OfferStatusFilter;
  minDiscount: number;
  priceMin: number | null;
  /// Centavos. null = sem teto.
  priceMax: number | null;
  watchId: string | null;
  search: string;
  sort: OfferSort;
  page: number;
  pageSize: number;
}

export interface OfferHistoryPoint {
  price: number;
  capturedAt: string;
}

export interface OfferListItem {
  id: string;
  status: OfferStatus;
  price: number;
  referencePrice: number;
  referenceKind: string;
  discountPct: number;
  score: number;
  detectedAt: string;
  product: {
    id: string;
    title: string;
    thumbnail: string | null;
    permalink: string;
    sellerName: string | null;
    sellerStatus: string | null;
    freeShipping: boolean;
    blocked: boolean;
    watchLabel: string | null;
  };
  history: OfferHistoryPoint[];
}

export interface OfferListResult {
  items: OfferListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface OfferStats {
  newToday: number;
  avgDiscount: number;
  bestDiscount: number;
  totalMonitored: number;
}

/// Efeito de uma configuração de detecção sobre as ofertas já guardadas.
export interface ImpactoDaDeteccao {
  /// Quantas continuam aparecendo.
  visiveis: number;
  /// Quantas deixam de aparecer (nada é apagado: voltam se o valor baixar).
  escondidas: number;
  /// Quantas, entre as visíveis, ganham o destaque de imperdível.
  imperdiveis: number;
  /// Quantas existem no total, antes de aplicar a configuração.
  total: number;
}

const HISTORY_DAYS = 30;
const HISTORY_MS = HISTORY_DAYS * 24 * 60 * 60 * 1000;
/// Pontos de sobra por produto no sparkline — o histórico pode ter uma
/// captura por varredura, então limitamos pra não pesar o card.
const HISTORY_POINTS_TAKE = 60;

/// A regra de visibilidade que vale AGORA, montada com a configuração salva.
/// Sai do mesmo `getSettings()` cacheado que a app inteira usa, então não custa
/// consulta extra nenhuma.
export async function getOfferVisibility(): Promise<OfferVisibility> {
  const s = await getSettings();
  return normalizeVisibility({
    minDiscount: s.minDiscount,
    minPrice: s.minPrice,
    minSoldQuantity: s.minSoldQuantity,
    hotDiscount: s.hotDiscount,
  });
}

/// O `where` da tela de ofertas: o que a configuração permite + o que o usuário
/// pediu nos filtros da própria tela. A configuração é sempre o piso; o filtro
/// da tela só consegue estreitar mais (pedir 10% com o mínimo em 30% continua
/// mostrando só o que tem 30% ou mais).
function whereFromFilters(
  filters: OfferFilters,
  visibility: OfferVisibility,
): Prisma.OfferWhereInput {
  const offer: Prisma.OfferWhereInput = {};

  if (filters.status !== "ALL") offer.status = filters.status;
  if (filters.minDiscount > 0) offer.discountPct = { gte: filters.minDiscount };

  if (filters.priceMin !== null || filters.priceMax !== null) {
    offer.price = {
      ...(filters.priceMin !== null ? { gte: filters.priceMin } : {}),
      ...(filters.priceMax !== null ? { lte: filters.priceMax } : {}),
    };
  }

  // Oferta de produto escondido pelo filtro de palavras não aparece nem conta.
  // A decisão já está materializada em Product.hiddenByWords, então isto é um
  // booleano indexado, não uma busca por texto. Mesma lógica para
  // affiliateEligible: só tira o que já foi CONFIRMADO como rejeitado (false);
  // pendente (null) e elegível (true) continuam aparecendo normalmente. NUNCA
  // usar `{ not: false }` aqui: em SQL, `coluna <> false` dá NULL (não true)
  // quando a coluna é NULL, então a linha some da consulta — precisa do OR
  // explícito com `null` para "pendente" continuar valendo.
  const product: Prisma.ProductWhereInput = {
    hiddenByWords: false,
    OR: [{ affiliateEligible: null }, { affiliateEligible: true }],
  };
  if (filters.watchId) product.watchId = filters.watchId;
  if (filters.search.trim()) {
    product.title = { contains: filters.search.trim(), mode: "insensitive" };
  }

  return ofertasVisiveisWhere(visibility, { offer, product });
}

/// Quantas ofertas a lista de palavras informada esconderia, SEM salvar nada.
/// Espelha `previewProdutosEscondidos` do lado das ofertas, para a prévia da
/// aba de configurações mostrar o impacto nas duas telas.
export async function previewOfertasEscondidas(filter: WordFilter): Promise<ImpactoDoFiltro> {
  const total = await prisma.offer.count();
  const cond = tituloEscondidoSql(filter, Prisma.sql`p."title"`);
  if (!cond) return { escondidos: 0, total };

  const rows = await prisma.$queryRaw<{ count: number }[]>(
    Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "Offer" o
      JOIN "Product" p ON p."id" = o."productId"
      WHERE ${cond}
    `,
  );
  return { escondidos: rows[0]?.count ?? 0, total };
}

/// O que uma configuração de detecção faria com as ofertas já guardadas, SEM
/// salvar nada. Alimenta a prévia da aba "Detecção": a pessoa vê quantas
/// continuam aparecendo e quantas somem ANTES de confirmar.
///
/// O universo (`total`) já desconta o que o filtro por palavras esconde, para
/// os dois filtros não contarem a mesma oferta duas vezes: aqui só entra o que
/// as palavras deixaram passar.
export async function previewOfertasVisiveis(
  visibility: OfferVisibility,
): Promise<ImpactoDaDeteccao> {
  const parts = {
    product: {
      hiddenByWords: false,
      OR: [{ affiliateEligible: null }, { affiliateEligible: true }],
    },
  };

  const [total, visiveis, imperdiveis] = await Promise.all([
    prisma.offer.count({ where: ofertasVisiveisWhere(VISIBILIDADE_ABERTA, parts) }),
    prisma.offer.count({ where: ofertasVisiveisWhere(visibility, parts) }),
    prisma.offer.count({ where: ofertasImperdiveisWhere(visibility, parts) }),
  ]);

  return { visiveis, escondidas: total - visiveis, imperdiveis, total };
}

function orderFromSort(sort: OfferSort): Prisma.OfferOrderByWithRelationInput[] {
  switch (sort) {
    case "discount":
      return [{ discountPct: "desc" }, { detectedAt: "desc" }];
    case "price":
      return [{ price: "asc" }];
    case "recent":
      return [{ detectedAt: "desc" }];
    case "score":
    default:
      return [{ score: "desc" }, { detectedAt: "desc" }];
  }
}

/// Lista paginada de ofertas com o suficiente para o card (produto + até
/// HISTORY_POINTS_TAKE pontos de histórico dos últimos 30 dias, pro sparkline).
/// unstable_cache é keyado pelos filtros E pela configuração de detecção em
/// vigor — cada combinação vira uma entrada própria, invalidada em bloco por
/// bust(TAGS.offers)/bust(TAGS.products)/bust(TAGS.settings). Mudar o desconto
/// mínimo muda a chave, então nenhuma tela chega a servir o recorte antigo.
export async function getOffers(filters: OfferFilters): Promise<OfferListResult> {
  const visibility = await getOfferVisibility();

  const load = unstable_cache(
    async (f: OfferFilters, v: OfferVisibility) => {
      const where = whereFromFilters(f, v);
      const skip = (f.page - 1) * f.pageSize;

      const [rows, total] = await Promise.all([
        prisma.offer.findMany({
          where,
          orderBy: orderFromSort(f.sort),
          skip,
          take: f.pageSize,
          include: {
            product: {
              select: {
                id: true,
                title: true,
                thumbnail: true,
                permalink: true,
                sellerName: true,
                sellerStatus: true,
                freeShipping: true,
                blocked: true,
                watch: { select: { label: true } },
                history: {
                  where: { capturedAt: { gte: new Date(Date.now() - HISTORY_MS) } },
                  orderBy: { capturedAt: "asc" },
                  take: HISTORY_POINTS_TAKE,
                  select: { price: true, capturedAt: true },
                },
              },
            },
          },
        }),
        prisma.offer.count({ where }),
      ]);

      const items: OfferListItem[] = rows.map((row) => ({
        id: row.id,
        status: row.status,
        price: row.price,
        referencePrice: row.referencePrice,
        referenceKind: row.referenceKind,
        discountPct: row.discountPct,
        score: row.score,
        detectedAt: row.detectedAt.toISOString(),
        product: {
          id: row.product.id,
          title: row.product.title,
          thumbnail: row.product.thumbnail,
          permalink: row.product.permalink,
          sellerName: row.product.sellerName,
          sellerStatus: row.product.sellerStatus,
          freeShipping: row.product.freeShipping,
          blocked: row.product.blocked,
          watchLabel: row.product.watch?.label ?? null,
        },
        history: row.product.history.map((h) => ({
          price: h.price,
          capturedAt: h.capturedAt.toISOString(),
        })),
      }));

      return {
        items,
        total,
        page: f.page,
        pageSize: f.pageSize,
        pageCount: Math.max(1, Math.ceil(total / f.pageSize)),
      };
    },
    ["offers-list", JSON.stringify(filters), visibilityKey(visibility)],
    { tags: [TAGS.offers, TAGS.products, TAGS.settings] },
  );

  return load(filters, visibility);
}

/// StatCards do topo da página: ofertas novas hoje, desconto médio, melhor
/// desconto (entre as NEW, o que o painel realmente precisa decidir agora) e
/// total de produtos monitorados (não bloqueados).
///
/// Os números saem da MESMA regra da listagem (filtro por palavras + a
/// configuração de detecção em vigor). É isso que impede o topo de dizer "97
/// ofertas" com 30 na tela.
export async function getOfferStats(): Promise<OfferStats> {
  const visibility = await getOfferVisibility();

  const load = unstable_cache(
    async (v: OfferVisibility): Promise<OfferStats> => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const parts = {
        product: {
          hiddenByWords: false,
          OR: [{ affiliateEligible: null }, { affiliateEligible: true }],
        } as Prisma.ProductWhereInput,
      };

      const [newToday, aggregates, totalMonitored] = await Promise.all([
        prisma.offer.count({
          where: ofertasVisiveisWhere(v, {
            ...parts,
            offer: { detectedAt: { gte: startOfDay } },
          }),
        }),
        prisma.offer.aggregate({
          where: ofertasVisiveisWhere(v, { ...parts, offer: { status: OfferStatus.NEW } }),
          _avg: { discountPct: true },
          _max: { discountPct: true },
        }),
        prisma.product.count({ where: { blocked: false, hiddenByWords: false } }),
      ]);

      return {
        newToday,
        avgDiscount: Math.round(aggregates._avg.discountPct ?? 0),
        bestDiscount: aggregates._max.discountPct ?? 0,
        totalMonitored,
      };
    },
    ["offers-stats", visibilityKey(visibility)],
    { tags: [TAGS.offers, TAGS.products, TAGS.settings] },
  );

  return load(visibility);
}

/// Pre-sells ativas, para o item "link com pre-sell" do GenerateLinkMenu.
export const getActivePresells = unstable_cache(
  async () => {
    return prisma.presell.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    });
  },
  ["offers-active-presells"],
  { tags: [TAGS.presells] },
);
