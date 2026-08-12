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
  MLCatalogSearchItem,
  MLProductSearchPaging,
  MLProductSearchResponse,
  NormalizedProduct,
} from "./types";

export { searchProducts, searchWatch, searchWatchDetailed, fetchItems } from "./search";
export type { WatchQuery, SearchOptions, SearchProductsInput, SearchResult } from "./search";

export {
  BEAUTY_ROOT,
  BEAUTY_SUBCATEGORIES,
  fetchCategory,
  fetchRootCategories,
  walkCategoryTree,
  isUnderCategory,
  clearCategoryCache,
} from "./categories";
export type {
  BeautySubcategory,
  CategoryNode,
  FlatCategory,
  CategoryOptions,
} from "./categories";

export {
  fetchCatalogProduct,
  catalogProductFromSearch,
  fetchCatalogListings,
  cheapestListing,
  normalizeListing,
  enrichFromItems,
  enrichProducts,
  mergeEnrichment,
  catalogPermalink,
  itemPermalink,
} from "./catalog";
export type { CatalogProduct, CatalogOptions } from "./catalog";

export { fetchHighlights, collectCategory, collectCategoryDetailed } from "./highlights";
export type { CategoryCollection, HighlightsOptions } from "./highlights";

export { collectForWatch, getCollectionMode } from "./collect";
export type {
  CollectionSource,
  CollectResult,
  CollectOptions,
  CollectSkipReason,
} from "./collect";

export { isFixtureMode, fixtureSearch, fixtureCount, fixtureRound, FIXTURE_CATEGORIES } from "./fixtures";
export type { FixtureQuery } from "./fixtures";
