/// Lógica compartilhada de CATÁLOGO do Mercado Livre.
///
/// Tanto os destaques de categoria (`highlights.ts`) quanto a busca por termo
/// (`search.ts`) terminam no mesmo ponto: um produto de catálogo (id, nome,
/// foto) que precisa virar um anúncio concreto com preço. Este módulo tem essa
/// parte comum — escolha do anúncio mais barato, montagem do permalink e
/// normalização — para que os dois caminhos não divirjam.
///
/// Limitações reais da API hoje (medidas em campo, não suposições):
///   - /products/{id} devolve `permalink` VAZIO -> o link é montado dos ids.
///   - /products/{id}/items responde 404 "No winners found" quando o produto
///     de catálogo não tem anúncio vencedor. É ausência de dado, não erro.
///   - /items e /items?ids= respondem 403 -> sem sold_quantity e sem nickname
///     do vendedor. O enriquecimento é tentado e ignorado quando falha.
///   - /products/{id} responde 403 para ids USER_PRODUCT (MLBU...).

import { mlRequest, isMLApiError } from "./client";
import { toCents } from "../format";
import { normalize } from "./types";
import type {
  MLCatalogListing,
  MLCatalogListingsResponse,
  MLCatalogProduct,
  MLCatalogSearchItem,
  MLItem,
  MLMultiGetEntry,
  MLProductPicture,
  NormalizedProduct,
} from "./types";

/// Limite do multiget /items?ids=
const MULTIGET_CHUNK = 20;

export interface CatalogOptions {
  signal?: AbortSignal;
  siteId?: string;
}

// ------------------------------------------------------- produto de catálogo

export interface CatalogProduct {
  id: string;
  title: string;
  thumbnail: string | null;
  /// Link do PDP montado a partir do id — a API devolve permalink vazio.
  permalink: string;
  status: string | null;
  domainId: string | null;
}

function pictureUrl(pictures: MLProductPicture[] | null | undefined): string | null {
  const first = pictures?.find((p) => p?.secure_url || p?.url);
  return first?.secure_url ?? first?.url ?? null;
}

/// PDP do produto de catálogo.
export function catalogPermalink(catalogId: string): string {
  return `https://www.mercadolivre.com.br/p/${catalogId}`;
}

/// Página do anúncio individual. Os ids têm a forma MLB1234567890.
export function itemPermalink(itemId: string): string {
  const match = /^([A-Za-z]{3})(\d+)$/.exec(itemId);
  return match
    ? `https://produto.mercadolivre.com.br/${match[1].toUpperCase()}-${match[2]}-_JM`
    : `https://www.mercadolivre.com.br/p/${itemId}`;
}

export async function fetchCatalogProduct(
  catalogId: string,
  options: CatalogOptions = {},
): Promise<CatalogProduct> {
  const raw = await mlRequest<MLCatalogProduct>(`/products/${encodeURIComponent(catalogId)}`, {
    signal: options.signal,
  });

  const permalink = raw.permalink?.trim();
  return {
    id: raw.id ?? catalogId,
    title: raw.name ?? raw.family_name ?? catalogId,
    thumbnail: pictureUrl(raw.pictures),
    permalink: permalink && permalink.length > 0 ? permalink : catalogPermalink(catalogId),
    status: raw.status ?? null,
    domainId: raw.domain_id ?? null,
  };
}

/// /products/search já devolve nome, fotos e domínio — o mesmo que
/// /products/{id} traria. Aproveitar isso economiza uma chamada por produto.
export function catalogProductFromSearch(item: MLCatalogSearchItem): CatalogProduct {
  return {
    id: item.id,
    title: item.name ?? item.id,
    thumbnail: pictureUrl(item.pictures),
    permalink: catalogPermalink(item.id),
    status: item.status ?? null,
    domainId: item.domain_id ?? null,
  };
}

/// Anúncios que disputam o mesmo produto de catálogo. Sem anúncio vencedor a
/// API responde 404: devolvemos lista vazia em vez de propagar erro.
export async function fetchCatalogListings(
  catalogId: string,
  options: CatalogOptions = {},
): Promise<MLCatalogListing[]> {
  let res: MLCatalogListingsResponse;
  try {
    res = await mlRequest<MLCatalogListingsResponse>(
      `/products/${encodeURIComponent(catalogId)}/items`,
      { signal: options.signal },
    );
  } catch (err) {
    if (isMLApiError(err) && err.status === 404) return [];
    throw err;
  }
  const results = Array.isArray(res.results) ? res.results : [];
  return results.filter((row) => Boolean(row?.item_id));
}

// ----------------------------------------------------- escolha do anúncio

function isEligible(listing: MLCatalogListing): boolean {
  if (!Number.isFinite(listing.price) || listing.price <= 0) return false;
  // `condition` nem sempre vem; quando vem, só aceitamos novo.
  const condition = listing.condition?.toLowerCase();
  if (condition && condition !== "new") return false;
  return true;
}

/// O anúncio mais barato entre os elegíveis — é dele que sai o link.
export function cheapestListing(listings: MLCatalogListing[]): MLCatalogListing | null {
  let best: MLCatalogListing | null = null;
  for (const listing of listings) {
    if (!isEligible(listing)) continue;
    if (!best || listing.price < best.price) best = listing;
  }
  return best;
}

/// Converte anúncio + produto de catálogo no formato do nosso Product.
export function normalizeListing(
  listing: MLCatalogListing,
  product: CatalogProduct,
): NormalizedProduct {
  const price = toCents(listing.price);
  const rawOriginal = listing.original_price;
  const original =
    typeof rawOriginal === "number" && Number.isFinite(rawOriginal) ? toCents(rawOriginal) : null;

  return {
    mlId: listing.item_id,
    catalogId: product.id,
    title: product.title,
    thumbnail: product.thumbnail,
    permalink: `${catalogPermalink(product.id)}?item_id=${listing.item_id}`,
    price,
    // "De" só vale quando é realmente maior que o preço atual.
    originalPrice: original !== null && original > price ? original : null,
    currency: listing.currency_id ?? "BRL",
    categoryId: listing.category_id ?? null,
    sellerId: listing.seller_id != null ? String(listing.seller_id) : null,
    sellerName: null,
    sellerStatus: null,
    freeShipping: listing.shipping?.free_shipping === true,
    soldQuantity:
      typeof listing.sold_quantity === "number" ? Math.max(0, Math.trunc(listing.sold_quantity)) : 0,
    available:
      typeof listing.available_quantity === "number"
        ? Math.max(0, Math.trunc(listing.available_quantity))
        : 0,
    condition: listing.condition ?? null,
    officialStore: listing.official_store_id != null,
  };
}

// ------------------------------------------------------------ enriquecimento

/// Completa o que /products/{id}/items não traz (vendas, nickname, thumbnail
/// melhor) com um multiget /items?ids=. Hoje esse endpoint responde 403 para
/// esta aplicação — por isso o resultado é sempre "melhor esforço": qualquer
/// falha devolve o mapa vazio em vez de derrubar a coleta.
export async function enrichFromItems(
  ids: string[],
  options: CatalogOptions = {},
): Promise<Map<string, MLItem>> {
  const byId = new Map<string, MLItem>();
  if (ids.length === 0) return byId;

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += MULTIGET_CHUNK) {
    chunks.push(ids.slice(i, i + MULTIGET_CHUNK));
  }

  const responses = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        return await mlRequest<MLMultiGetEntry[]>("/items", {
          searchParams: { ids: chunk.join(",") },
          signal: options.signal,
        });
      } catch {
        return [];
      }
    }),
  );

  for (const entries of responses) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry?.code === 200 && entry.body?.id) byId.set(entry.body.id, entry.body);
    }
  }
  return byId;
}

/// Aplica os campos do multiget sobre o produto já normalizado, sem deixar
/// que um dado ausente sobrescreva o que veio do catálogo.
export function mergeEnrichment(base: NormalizedProduct, item: MLItem): NormalizedProduct {
  const enriched = normalize(item);
  return {
    ...base,
    title: enriched.title || base.title,
    thumbnail: enriched.thumbnail ?? base.thumbnail,
    permalink: enriched.permalink || base.permalink,
    sellerName: enriched.sellerName ?? base.sellerName,
    sellerStatus: enriched.sellerStatus ?? base.sellerStatus,
    sellerId: enriched.sellerId ?? base.sellerId,
    soldQuantity: enriched.soldQuantity > 0 ? enriched.soldQuantity : base.soldQuantity,
    available: enriched.available > 0 ? enriched.available : base.available,
    condition: enriched.condition ?? base.condition,
  };
}

/// Aplica o enriquecimento em lote sobre uma lista já normalizada.
export async function enrichProducts(
  products: NormalizedProduct[],
  options: CatalogOptions = {},
): Promise<{ products: NormalizedProduct[]; enriched: boolean }> {
  const extra = await enrichFromItems(
    products.map((p) => p.mlId),
    options,
  );
  if (extra.size === 0) return { products, enriched: false };
  return {
    products: products.map((product) => {
      const item = extra.get(product.mlId);
      return item ? mergeEnrichment(product, item) : product;
    }),
    enriched: true,
  };
}
