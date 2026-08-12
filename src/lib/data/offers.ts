import "server-only";
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { createLink, publicUrl } from "@/lib/links";
import { TAGS, bust } from "@/lib/cache";
import { OfferStatus, LinkKind, Prisma } from "@/generated/prisma";

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

const HISTORY_DAYS = 30;
const HISTORY_MS = HISTORY_DAYS * 24 * 60 * 60 * 1000;
/// Pontos de sobra por produto no sparkline — o histórico pode ter uma
/// captura por varredura, então limitamos pra não pesar o card.
const HISTORY_POINTS_TAKE = 60;

function whereFromFilters(filters: OfferFilters): Prisma.OfferWhereInput {
  const where: Prisma.OfferWhereInput = {};

  if (filters.status !== "ALL") where.status = filters.status;
  if (filters.minDiscount > 0) where.discountPct = { gte: filters.minDiscount };

  if (filters.priceMin !== null || filters.priceMax !== null) {
    where.price = {
      ...(filters.priceMin !== null ? { gte: filters.priceMin } : {}),
      ...(filters.priceMax !== null ? { lte: filters.priceMax } : {}),
    };
  }

  const productWhere: Prisma.ProductWhereInput = {};
  if (filters.watchId) productWhere.watchId = filters.watchId;
  if (filters.search.trim()) {
    productWhere.title = { contains: filters.search.trim(), mode: "insensitive" };
  }
  if (Object.keys(productWhere).length > 0) where.product = productWhere;

  return where;
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
/// unstable_cache é keyado pelos filtros — cada combinação vira uma entrada
/// própria, invalidada em bloco por bust(TAGS.offers)/bust(TAGS.products).
export async function getOffers(filters: OfferFilters): Promise<OfferListResult> {
  const load = unstable_cache(
    async (f: OfferFilters) => {
      const where = whereFromFilters(f);
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
    ["offers-list", JSON.stringify(filters)],
    { tags: [TAGS.offers, TAGS.products] },
  );

  return load(filters);
}

/// StatCards do topo da página: ofertas novas hoje, desconto médio, melhor
/// desconto (entre as NEW, o que o painel realmente precisa decidir agora) e
/// total de produtos monitorados (não bloqueados).
export const getOfferStats = unstable_cache(
  async (): Promise<OfferStats> => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [newToday, aggregates, totalMonitored] = await Promise.all([
      prisma.offer.count({ where: { detectedAt: { gte: startOfDay } } }),
      prisma.offer.aggregate({
        where: { status: OfferStatus.NEW },
        _avg: { discountPct: true },
        _max: { discountPct: true },
      }),
      prisma.product.count({ where: { blocked: false } }),
    ]);

    return {
      newToday,
      avgDiscount: Math.round(aggregates._avg.discountPct ?? 0),
      bestDiscount: aggregates._max.discountPct ?? 0,
      totalMonitored,
    };
  },
  ["offers-stats"],
  { tags: [TAGS.offers, TAGS.products] },
);

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
