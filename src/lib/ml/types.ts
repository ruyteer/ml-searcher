/// Tipos das respostas da API do Mercado Livre — só o que a aplicação usa.
/// Os nomes dos campos são exatamente os que a API devolve (snake_case).
/// A conversão para o formato do nosso Product acontece em `normalize()`.

import { toCents } from "../format";

// ------------------------------------------------------------------ API crua

export interface MLSellerReputation {
  /// platinum | gold | silver | null — o ML devolve null para quem não é power seller.
  power_seller_status?: string | null;
  level_id?: string | null;
}

export interface MLSeller {
  id: number;
  nickname?: string | null;
  seller_reputation?: MLSellerReputation | null;
}

export interface MLShipping {
  free_shipping?: boolean;
}

/// Item de /sites/{site}/search e de /items/{id}. Os dois endpoints devolvem
/// o mesmo shape para os campos que usamos, mas a busca costuma omitir
/// `sold_quantity` — por isso quase tudo aqui é opcional.
export interface MLItem {
  id: string;
  title: string;
  thumbnail?: string | null;
  secure_thumbnail?: string | null;
  permalink: string;
  price: number;
  original_price?: number | null;
  currency_id?: string | null;
  available_quantity?: number | null;
  sold_quantity?: number | null;
  condition?: string | null;
  category_id?: string | null;
  seller?: MLSeller | null;
  seller_id?: number | null;
  shipping?: MLShipping | null;
  official_store_id?: number | null;
  /// Produto de catálogo ao qual o anúncio pertence, quando houver.
  catalog_product_id?: string | null;
}

export interface MLPaging {
  total: number;
  offset: number;
  limit: number;
  primary_results?: number;
}

export interface MLSearchResponse {
  site_id: string;
  query?: string | null;
  paging: MLPaging;
  results: MLItem[];
}

/// Resposta do multiget /items?ids=A,B,C
export interface MLMultiGetEntry {
  code: number;
  body: MLItem;
}

/// Corpo de erro padrão do ML.
export interface MLErrorBody {
  message?: string;
  error?: string;
  status?: number;
  cause?: unknown;
}

// ------------------------------------------------ categorias / destaques / catálogo

export interface MLCategoryRef {
  id: string;
  name: string;
  total_items_in_this_category?: number;
}

/// Item de /sites/{site}/categories.
export interface MLRootCategory {
  id: string;
  name: string;
}

/// Resposta de /categories/{id}.
export interface MLCategoryResponse {
  id: string;
  name: string;
  path_from_root?: MLCategoryRef[];
  children_categories?: MLCategoryRef[];
}

export type MLHighlightType = "PRODUCT" | "USER_PRODUCT";

export interface MLHighlightEntry {
  id: string;
  position: number;
  type: MLHighlightType | string;
}

/// Resposta de /highlights/{site}/category/{id}.
export interface MLHighlightsResponse {
  query_data?: { highlight_type?: string; criteria?: string; id?: string };
  content?: MLHighlightEntry[];
}

export interface MLProductPicture {
  id?: string;
  url?: string | null;
  secure_url?: string | null;
}

/// Resposta de /products/{catalogId}. `permalink` costuma vir vazio na
/// resposta da API — o link utilizável é montado a partir dos ids.
export interface MLCatalogProduct {
  id: string;
  catalog_product_id?: string | null;
  name: string;
  family_name?: string | null;
  status?: string | null;
  domain_id?: string | null;
  permalink?: string | null;
  pictures?: MLProductPicture[] | null;
  buy_box_winner?: { item_id?: string | null; price?: number | null } | null;
}

/// Um anúncio de /products/{catalogId}/items. Note que NÃO traz título,
/// permalink, thumbnail, sold_quantity nem nickname do vendedor.
export interface MLCatalogListing {
  item_id: string;
  seller_id?: number | null;
  price: number;
  original_price?: number | null;
  currency_id?: string | null;
  condition?: string | null;
  category_id?: string | null;
  official_store_id?: number | null;
  available_quantity?: number | null;
  sold_quantity?: number | null;
  tags?: string[] | null;
  deal_ids?: string[] | null;
  shipping?: MLShipping | null;
  inventory_id?: string | null;
  user_product_id?: string | null;
}

export interface MLCatalogListingsResponse {
  paging?: MLPaging;
  results?: MLCatalogListing[];
}

// ------------------------------------------------------- formato da aplicação

/// Produto já traduzido para o vocabulário do nosso schema.
/// Todos os preços em CENTAVOS.
export interface NormalizedProduct {
  mlId: string;
  /// Produto de catálogo de origem, quando a coleta veio pelos destaques.
  catalogId: string | null;
  title: string;
  thumbnail: string | null;
  permalink: string;
  price: number;
  originalPrice: number | null;
  currency: string;
  categoryId: string | null;
  sellerId: string | null;
  sellerName: string | null;
  sellerStatus: string | null;
  freeShipping: boolean;
  soldQuantity: number;
  available: number;
  condition: string | null;
  officialStore: boolean;
}

/// /items traz o vendedor aninhado; /products/{id}/items só traz seller_id.
function sellerIdOf(item: MLItem): string | null {
  if (item.seller?.id != null) return String(item.seller.id);
  if (item.seller_id != null) return String(item.seller_id);
  return null;
}

function intOrZero(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function normalize(item: MLItem): NormalizedProduct {
  const price = toCents(item.price);
  const rawOriginal = item.original_price;
  // "De" só vale quando é realmente maior que o preço atual — o ML às vezes
  // devolve original_price igual ou menor, o que zeraria o desconto.
  const original =
    typeof rawOriginal === "number" && Number.isFinite(rawOriginal) ? toCents(rawOriginal) : null;
  const originalPrice = original !== null && original > price ? original : null;

  return {
    mlId: item.id,
    catalogId: item.catalog_product_id ?? null,
    title: item.title,
    thumbnail: item.secure_thumbnail ?? item.thumbnail ?? null,
    permalink: item.permalink,
    price,
    originalPrice,
    currency: item.currency_id ?? "BRL",
    categoryId: item.category_id ?? null,
    sellerId: sellerIdOf(item),
    sellerName: item.seller?.nickname ?? null,
    sellerStatus: item.seller?.seller_reputation?.power_seller_status ?? null,
    freeShipping: item.shipping?.free_shipping === true,
    soldQuantity: intOrZero(item.sold_quantity),
    available: intOrZero(item.available_quantity),
    condition: item.condition ?? null,
    officialStore: item.official_store_id != null,
  };
}

export function normalizeMany(items: MLItem[]): NormalizedProduct[] {
  return items.map(normalize);
}
