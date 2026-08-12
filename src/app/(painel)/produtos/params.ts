import { createLoader, parseAsFloat, parseAsInteger, parseAsString, parseAsStringEnum } from "nuqs/server";
import type { BlockedFilter, ProductFilters, ProductSort, SortDir } from "@/lib/data/products";

export const PRODUCTS_PAGE_SIZE = 20;

const SORT_VALUES: ProductSort[] = ["title", "price", "lastSeen", "sold"];
const DIR_VALUES: SortDir[] = ["asc", "desc"];
const BLOCKED_VALUES: BlockedFilter[] = ["all", "blocked", "unblocked"];

/// Parsers nuqs compartilhados entre o loader do servidor e o cliente —
/// mesmo padrão de /ofertas/params.ts.
export const productsParsers = {
  search: parseAsString.withDefault(""),
  watchId: parseAsString,
  priceMin: parseAsFloat,
  priceMax: parseAsFloat,
  blocked: parseAsStringEnum<BlockedFilter>(BLOCKED_VALUES).withDefault("unblocked"),
  sort: parseAsStringEnum<ProductSort>(SORT_VALUES).withDefault("lastSeen"),
  sortDir: parseAsStringEnum<SortDir>(DIR_VALUES).withDefault("desc"),
  page: parseAsInteger.withDefault(1),
};

export const loadProductsParams = createLoader(productsParsers);

export function toProductFilters(params: Awaited<ReturnType<typeof loadProductsParams>>): ProductFilters {
  return {
    search: params.search,
    watchId: params.watchId || null,
    priceMin: params.priceMin !== null ? Math.round(params.priceMin * 100) : null,
    priceMax: params.priceMax !== null ? Math.round(params.priceMax * 100) : null,
    blocked: params.blocked,
    sort: params.sort,
    sortDir: params.sortDir,
    page: Math.max(1, params.page),
    pageSize: PRODUCTS_PAGE_SIZE,
  };
}
