import "server-only";
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { publicUrl } from "@/lib/links";
import { TAGS, bust } from "@/lib/cache";
import { Prisma, OfferStatus } from "@/generated/prisma";

// ------------------------------------------------------------------ tipos

export type ProductSort = "title" | "price" | "lastSeen" | "sold";
export type SortDir = "asc" | "desc";
export type BlockedFilter = "all" | "blocked" | "unblocked";

export interface ProductFilters {
  search: string;
  watchId: string | null;
  priceMin: number | null;
  priceMax: number | null;
  blocked: BlockedFilter;
  sort: ProductSort;
  sortDir: SortDir;
  page: number;
  pageSize: number;
}

export interface ProductListItem {
  id: string;
  title: string;
  thumbnail: string | null;
  price: number;
  sellerName: string | null;
  soldQuantity: number;
  categoryName: string | null;
  watchLabel: string | null;
  blocked: boolean;
  lastSeenAt: string;
  /// Menor preço já registrado no histórico (ou o preço atual, se ainda não há histórico).
  lowestPrice: number;
  /// Variação % do preço atual vs. a média histórica (negativo = abaixo da média).
  variationPct: number | null;
}

export interface ProductListResult {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface WatchOption {
  id: string;
  label: string;
}

function whereFromFilters(filters: ProductFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  if (filters.blocked === "blocked") where.blocked = true;
  else if (filters.blocked === "unblocked") where.blocked = false;

  if (filters.watchId) where.watchId = filters.watchId;
  if (filters.search.trim()) where.title = { contains: filters.search.trim(), mode: "insensitive" };

  if (filters.priceMin !== null || filters.priceMax !== null) {
    where.price = {
      ...(filters.priceMin !== null ? { gte: filters.priceMin } : {}),
      ...(filters.priceMax !== null ? { lte: filters.priceMax } : {}),
    };
  }

  return where;
}

function orderFromSort(sort: ProductSort, dir: SortDir): Prisma.ProductOrderByWithRelationInput[] {
  const order = dir === "asc" ? "asc" : "desc";
  switch (sort) {
    case "title":
      return [{ title: order }];
    case "price":
      return [{ price: order }];
    case "sold":
      return [{ soldQuantity: order }];
    case "lastSeen":
    default:
      return [{ lastSeenAt: order }];
  }
}

/// Catálogo completo, paginado no banco. lowestPrice/variationPct são
/// calculados à parte (agregado só sobre os IDs da página atual) porque não
/// dá pra ordenar por eles via Prisma sem SQL cru — mantemos a ordenação nas
/// colunas nativas do Product e exibimos as duas como informativas.
export async function getProducts(filters: ProductFilters): Promise<ProductListResult> {
  const load = unstable_cache(
    async (f: ProductFilters) => {
      const where = whereFromFilters(f);
      const skip = (f.page - 1) * f.pageSize;

      const [rows, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy: orderFromSort(f.sort, f.sortDir),
          skip,
          take: f.pageSize,
          select: {
            id: true,
            title: true,
            thumbnail: true,
            price: true,
            sellerName: true,
            soldQuantity: true,
            categoryName: true,
            blocked: true,
            lastSeenAt: true,
            watch: { select: { label: true } },
          },
        }),
        prisma.product.count({ where }),
      ]);

      const ids = rows.map((r) => r.id);
      const [mins, avgs] = ids.length
        ? await Promise.all([
            prisma.priceHistory.groupBy({ by: ["productId"], where: { productId: { in: ids } }, _min: { price: true } }),
            prisma.priceHistory.groupBy({ by: ["productId"], where: { productId: { in: ids } }, _avg: { price: true } }),
          ])
        : [[], []];

      const minByProduct = new Map(mins.map((m) => [m.productId, m._min.price ?? null]));
      const avgByProduct = new Map(avgs.map((a) => [a.productId, a._avg.price ?? null]));

      const items: ProductListItem[] = rows.map((row) => {
        const min = minByProduct.get(row.id);
        const avg = avgByProduct.get(row.id);
        return {
          id: row.id,
          title: row.title,
          thumbnail: row.thumbnail,
          price: row.price,
          sellerName: row.sellerName,
          soldQuantity: row.soldQuantity,
          categoryName: row.categoryName,
          watchLabel: row.watch?.label ?? null,
          blocked: row.blocked,
          lastSeenAt: row.lastSeenAt.toISOString(),
          lowestPrice: typeof min === "number" ? Math.min(min, row.price) : row.price,
          variationPct: typeof avg === "number" && avg > 0 ? Math.round(((row.price - avg) / avg) * 100) : null,
        };
      });

      return {
        items,
        total,
        page: f.page,
        pageSize: f.pageSize,
        pageCount: Math.max(1, Math.ceil(total / f.pageSize)),
      };
    },
    ["products-list", JSON.stringify(filters)],
    { tags: [TAGS.products] },
  );

  return load(filters);
}

/// Opções da watch para o filtro (compartilhado entre /ofertas e /produtos).
export const getWatchOptions = unstable_cache(
  async (): Promise<WatchOption[]> => {
    const rows = await prisma.watch.findMany({
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    });
    return rows;
  },
  ["watch-options"],
  { tags: [TAGS.watches] },
);

// ------------------------------------------------------------- detalhe (Sheet)

export interface ProductDetailHistoryPoint {
  price: number;
  capturedAt: string;
}

export interface ProductDetailOffer {
  id: string;
  status: OfferStatus;
  price: number;
  referencePrice: number;
  discountPct: number;
  score: number;
  detectedAt: string;
}

export interface ProductDetailLink {
  id: string;
  slug: string;
  kind: string;
  label: string | null;
  clickCount: number;
  createdAt: string;
  active: boolean;
  /// URL pública já resolvida (publicUrl), pronta pra copiar.
  url: string;
}

export interface ProductDetail {
  id: string;
  mlId: string;
  title: string;
  thumbnail: string | null;
  permalink: string;
  price: number;
  originalPrice: number | null;
  sellerName: string | null;
  sellerStatus: string | null;
  soldQuantity: number;
  freeShipping: boolean;
  categoryName: string | null;
  watchLabel: string | null;
  blocked: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  history: ProductDetailHistoryPoint[];
  offers: ProductDetailOffer[];
  links: ProductDetailLink[];
}

export async function loadProductDetail(productId: string): Promise<ProductDetail | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      watch: { select: { label: true } },
      history: { orderBy: { capturedAt: "asc" }, select: { price: true, capturedAt: true } },
      offers: {
        orderBy: { detectedAt: "desc" },
        take: 50,
        select: { id: true, status: true, price: true, referencePrice: true, discountPct: true, score: true, detectedAt: true },
      },
      links: {
        orderBy: { createdAt: "desc" },
        select: { id: true, slug: true, kind: true, label: true, clickCount: true, createdAt: true, active: true, targetUrl: true },
      },
    },
  });
  if (!product) return null;

  const settings = await getSettings();
  const hdrs = await headers();
  const linkUrl = (link: { slug: string; kind: string; targetUrl: string }) =>
    link.kind === "DIRECT" ? link.targetUrl : publicUrl(`/${link.kind === "PRESELL" ? "p" : "r"}/${link.slug}`, settings, hdrs);

  return {
    id: product.id,
    mlId: product.mlId,
    title: product.title,
    thumbnail: product.thumbnail,
    permalink: product.permalink,
    price: product.price,
    originalPrice: product.originalPrice,
    sellerName: product.sellerName,
    sellerStatus: product.sellerStatus,
    soldQuantity: product.soldQuantity,
    freeShipping: product.freeShipping,
    categoryName: product.categoryName,
    watchLabel: product.watch?.label ?? null,
    blocked: product.blocked,
    firstSeenAt: product.firstSeenAt.toISOString(),
    lastSeenAt: product.lastSeenAt.toISOString(),
    history: product.history.map((h) => ({ price: h.price, capturedAt: h.capturedAt.toISOString() })),
    offers: product.offers.map((o) => ({
      id: o.id,
      status: o.status,
      price: o.price,
      referencePrice: o.referencePrice,
      discountPct: o.discountPct,
      score: o.score,
      detectedAt: o.detectedAt.toISOString(),
    })),
    links: product.links.map((l) => ({
      id: l.id,
      slug: l.slug,
      kind: l.kind,
      label: l.label,
      clickCount: l.clickCount,
      createdAt: l.createdAt.toISOString(),
      active: l.active,
      url: linkUrl(l),
    })),
  };
}
