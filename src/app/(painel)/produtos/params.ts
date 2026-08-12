import {
  createLoader,
  parseAsBoolean,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";
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
  /// Escape hatch consciente: o usuário pediu para ver o catálogo inteiro,
  /// sem escolher categoria. Sem isto a página abre convidando a escolher, em
  /// vez de despejar dezenas de milhares de linhas.
  tudo: parseAsBoolean.withDefault(false),
};

export const loadProductsParams = createLoader(productsParsers);

export type ProductsParams = Awaited<ReturnType<typeof loadProductsParams>>;

export function toProductFilters(params: ProductsParams): ProductFilters {
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

/// A listagem só aparece quando o usuário disse o que quer ver: uma categoria,
/// uma busca por nome, a lista de bloqueados ou "ver tudo" explicitamente.
/// Fora isso a página abre no seletor de categorias.
export function shouldListProducts(params: ProductsParams): boolean {
  return (
    params.tudo ||
    Boolean(params.watchId) ||
    params.search.trim().length > 0 ||
    params.blocked === "blocked"
  );
}
