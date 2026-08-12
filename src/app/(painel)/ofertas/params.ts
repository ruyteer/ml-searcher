import { createLoader, parseAsFloat, parseAsInteger, parseAsString, parseAsStringEnum } from "nuqs/server";
import type { OfferFilters, OfferSort, OfferStatusFilter } from "@/lib/data/offers";

/// Página cheia de grid — 24 cai certinho em grades de 2/3/4 colunas.
export const OFFERS_PAGE_SIZE = 24;

const STATUS_VALUES: OfferStatusFilter[] = ["NEW", "PUBLISHED", "IGNORED", "ALL"];
const SORT_VALUES: OfferSort[] = ["score", "discount", "price", "recent"];

/// Parsers nuqs compartilhados entre o loader do servidor (page.tsx) e o
/// useQueryStates do cliente (filters.tsx) — filtro na URL é compartilhável
/// e sobrevive a refresh.
export const offersParsers = {
  status: parseAsStringEnum<OfferStatusFilter>(STATUS_VALUES).withDefault("NEW"),
  minDiscount: parseAsInteger.withDefault(0),
  /// Faixa de preço em reais (exibida ao usuário); convertida pra centavos
  /// só na hora de montar o OfferFilters.
  priceMin: parseAsFloat,
  priceMax: parseAsFloat,
  watchId: parseAsString,
  search: parseAsString.withDefault(""),
  sort: parseAsStringEnum<OfferSort>(SORT_VALUES).withDefault("score"),
  page: parseAsInteger.withDefault(1),
};

export const loadOffersParams = createLoader(offersParsers);

export function toOfferFilters(params: Awaited<ReturnType<typeof loadOffersParams>>): OfferFilters {
  return {
    status: params.status,
    minDiscount: Math.max(0, params.minDiscount),
    priceMin: params.priceMin !== null ? Math.round(params.priceMin * 100) : null,
    priceMax: params.priceMax !== null ? Math.round(params.priceMax * 100) : null,
    watchId: params.watchId || null,
    search: params.search,
    sort: params.sort,
    page: Math.max(1, params.page),
    pageSize: OFFERS_PAGE_SIZE,
  };
}
