/// API pública da integração com o Mercado Livre.

export {
  MLApiError,
  isMLApiError,
  ML_API_BASE,
  mlRequest,
  getAccessToken,
  clearTokenCache,
  getCredentials,
  requireCredentials,
  setMaxConcurrency,
  getMaxConcurrency,
} from "./client";
export type { MLErrorCode, MLApiErrorInit, MLCredentials, MLRequestOptions } from "./client";

export { normalize, normalizeMany } from "./types";
export type {
  MLItem,
  MLSeller,
  MLSellerReputation,
  MLShipping,
  MLPaging,
  MLSearchResponse,
  MLMultiGetEntry,
  MLErrorBody,
  NormalizedProduct,
} from "./types";

export { searchWatch, searchWatchDetailed, fetchItems } from "./search";
export type { WatchQuery, SearchOptions, SearchResult } from "./search";

export { isFixtureMode, fixtureSearch, fixtureCount, fixtureRound, FIXTURE_CATEGORIES } from "./fixtures";
export type { FixtureQuery } from "./fixtures";
