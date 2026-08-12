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
  MLRootCategory,
  MLCategoryRef,
  MLCategoryResponse,
  MLHighlightType,
  MLHighlightEntry,
  MLHighlightsResponse,
  MLProductPicture,
  MLCatalogProduct,
  MLCatalogListing,
  MLCatalogListingsResponse,
  NormalizedProduct,
} from "./types";

export { searchWatch, searchWatchDetailed, fetchItems } from "./search";
export type { WatchQuery, SearchOptions, SearchResult } from "./search";

export {
  BEAUTY_ROOT,
  BEAUTY_SUBCATEGORIES,
  fetchCategory,
  fetchRootCategories,
  walkCategoryTree,
  clearCategoryCache,
} from "./categories";
export type {
  BeautySubcategory,
  CategoryNode,
  FlatCategory,
  CategoryOptions,
} from "./categories";

export {
  fetchHighlights,
  fetchCatalogProduct,
  fetchCatalogListings,
  cheapestListing,
  normalizeListing,
  enrichFromItems,
  collectCategory,
  collectCategoryDetailed,
  catalogPermalink,
  itemPermalink,
} from "./highlights";
export type { CatalogProduct, CategoryCollection, HighlightsOptions } from "./highlights";

export {
  collectForWatch,
  getCollectionMode,
  resetSearchBlock,
  isSearchBlocked,
  getSearchBlockedUntil,
} from "./collect";
export type {
  CollectionSource,
  CollectResult,
  CollectOptions,
  CollectSkipReason,
} from "./collect";

export { isFixtureMode, fixtureSearch, fixtureCount, fixtureRound, FIXTURE_CATEGORIES } from "./fixtures";
export type { FixtureQuery } from "./fixtures";
