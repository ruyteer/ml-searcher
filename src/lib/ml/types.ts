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
  shipping?: MLShipping | null;
  official_store_id?: number | null;
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

// ------------------------------------------------------- formato da aplicação

/// Produto já traduzido para o vocabulário do nosso schema.
/// Todos os preços em CENTAVOS.
export interface NormalizedProduct {
  mlId: string;
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
    title: item.title,
    thumbnail: item.secure_thumbnail ?? item.thumbnail ?? null,
    permalink: item.permalink,
    price,
    originalPrice,
    currency: item.currency_id ?? "BRL",
    categoryId: item.category_id ?? null,
    sellerId: item.seller?.id != null ? String(item.seller.id) : null,
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
