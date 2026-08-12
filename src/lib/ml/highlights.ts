/// Coleta pelos DESTAQUES de categoria — caminho principal hoje, já que
/// /sites/MLB/search está bloqueado (403) para a aplicação.
///
/// Fluxo por categoria:
///   /highlights/MLB/category/{id}   -> ids de produto de catálogo
///   /products/{catalogId}           -> nome e foto (os anúncios não têm título)
///   /products/{catalogId}/items     -> os anúncios; escolhemos o mais barato
///
/// Limitações reais da API hoje (medidas em campo, não suposições):
///   - /products/{id} devolve `permalink` VAZIO -> o link é montado dos ids.
///   - /items e /items?ids= respondem 403 -> sem sold_quantity e sem nickname
///     do vendedor. O enriquecimento é tentado e ignorado quando falha.
///   - /products/{id} responde 403 para ids USER_PRODUCT (MLBU...), então esses
///     destaques só entram se conseguirmos um título por outro caminho.

import { mlRequest, isMLApiError } from "./client";
import { toCents } from "../format";
import { normalize } from "./types";
import type {
  MLCatalogListing,
  MLCatalogListingsResponse,
  MLCatalogProduct,
  MLHighlightEntry,
  MLHighlightsResponse,
  MLItem,
  MLMultiGetEntry,
  NormalizedProduct,
} from "./types";

/// Limite do multiget /items?ids=
const MULTIGET_CHUNK = 20;
/// Os destaques trazem ~20 itens; este é o teto quando a watch não define um.
const DEFAULT_LIMIT = 20;

export interface HighlightsOptions {
  signal?: AbortSignal;
  siteId?: string;
}

// -------------------------------------------------------------- destaques

/// Ids de produto de catálogo em destaque na categoria, na ordem do ML.
/// PRODUCT e USER_PRODUCT são mantidos — a resolução para anúncio acontece
/// depois, em collectCategory.
export async function fetchHighlights(
  categoryId: string,
  options: HighlightsOptions = {},
): Promise<MLHighlightEntry[]> {
  const site = options.siteId ?? "MLB";

  // Nem toda categoria tem ranking de destaques — "Outros" (MLB1275), por
  // exemplo, responde 404. Isso é ausência de dado, não erro: devolvemos
  // lista vazia para a varredura seguir sem marcar a categoria como falha.
  let res: MLHighlightsResponse;
  try {
    res = await mlRequest<MLHighlightsResponse>(
      `/highlights/${encodeURIComponent(site)}/category/${encodeURIComponent(categoryId)}`,
      { signal: options.signal },
    );
  } catch (err) {
    if (isMLApiError(err) && err.status === 404) return [];
    throw err;
  }

  const content = Array.isArray(res.content) ? res.content : [];
  const seen = new Set<string>();
  const out: MLHighlightEntry[] = [];
  for (const entry of content) {
    if (!entry?.id) continue;
    if (entry.type !== "PRODUCT" && entry.type !== "USER_PRODUCT") continue;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
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

function pictureUrl(product: MLCatalogProduct): string | null {
  const first = product.pictures?.find((p) => p?.secure_url || p?.url);
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
  options: HighlightsOptions = {},
): Promise<CatalogProduct> {
  const raw = await mlRequest<MLCatalogProduct>(`/products/${encodeURIComponent(catalogId)}`, {
    signal: options.signal,
  });

  const permalink = raw.permalink?.trim();
  return {
    id: raw.id ?? catalogId,
    title: raw.name ?? raw.family_name ?? catalogId,
    thumbnail: pictureUrl(raw),
    permalink: permalink && permalink.length > 0 ? permalink : catalogPermalink(catalogId),
    status: raw.status ?? null,
    domainId: raw.domain_id ?? null,
  };
}

/// Anúncios que disputam o mesmo produto de catálogo.
export async function fetchCatalogListings(
  catalogId: string,
  options: HighlightsOptions = {},
): Promise<MLCatalogListing[]> {
  const res = await mlRequest<MLCatalogListingsResponse>(
    `/products/${encodeURIComponent(catalogId)}/items`,
    { signal: options.signal },
  );
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
/// falha devolve o mapa vazio em vez de derrubar a categoria.
export async function enrichFromItems(
  ids: string[],
  options: HighlightsOptions = {},
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
function mergeEnrichment(base: NormalizedProduct, item: MLItem): NormalizedProduct {
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

// ----------------------------------------------------------- coleta completa

export interface CategoryCollection {
  products: NormalizedProduct[];
  /// Produtos de catálogo devolvidos pelos destaques.
  highlightsSeen: number;
  /// Anúncios avaliados somando todos os produtos de catálogo.
  listingsSeen: number;
  /// Produtos de catálogo que não renderam nenhum anúncio elegível.
  skipped: number;
  /// Destaques do tipo USER_PRODUCT (MLBU...): /products/{id} responde 403,
  /// então não há título nem foto e o anúncio não pode virar Product.
  userProducts: number;
  /// Produtos de catálogo que falharam por outro motivo (rede, 5xx, ...).
  failed: number;
  /// true quando o multiget /items trouxe algo (hoje: bloqueado).
  enriched: boolean;
}

type CatalogFailure = "none" | "user-product" | "error";

interface CatalogOutcome {
  product: NormalizedProduct | null;
  listings: number;
  failure: CatalogFailure;
}

/// Ids de anúncio próprio do vendedor, sem página de catálogo pública.
function isUserProductId(id: string): boolean {
  return id.toUpperCase().startsWith("MLBU");
}

async function collectCatalogProduct(
  catalogId: string,
  options: HighlightsOptions,
): Promise<CatalogOutcome> {
  // allSettled: a contagem de anúncios continua valendo mesmo quando o
  // /products/{id} falha, e um produto inacessível não derruba a categoria.
  const [productRes, listingsRes] = await Promise.allSettled([
    fetchCatalogProduct(catalogId, options),
    fetchCatalogListings(catalogId, options),
  ]);

  for (const res of [productRes, listingsRes]) {
    if (res.status === "rejected" && isMLApiError(res.reason) && res.reason.code === "ABORTED") {
      throw res.reason;
    }
  }

  const listings = listingsRes.status === "fulfilled" ? listingsRes.value : [];

  if (productRes.status === "rejected") {
    return {
      product: null,
      listings: listings.length,
      failure: isUserProductId(catalogId) ? "user-product" : "error",
    };
  }

  const best = cheapestListing(listings);
  if (!best) return { product: null, listings: listings.length, failure: "none" };
  return {
    product: normalizeListing(best, productRes.value),
    listings: listings.length,
    failure: "none",
  };
}

/// Coleta uma categoria inteira pelos destaques e devolve os produtos já
/// normalizados, no mesmo shape que `searchWatch` entrega ao run.ts.
export async function collectCategoryDetailed(
  categoryId: string,
  limit = DEFAULT_LIMIT,
  options: HighlightsOptions = {},
): Promise<CategoryCollection> {
  const cap = limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
  const highlights = (await fetchHighlights(categoryId, options)).slice(0, cap);

  // Paralelo por produto de catálogo — o semáforo do client limita a vazão.
  const outcomes = await Promise.all(
    highlights.map((entry) => collectCatalogProduct(entry.id, options)),
  );

  let listingsSeen = 0;
  let failed = 0;
  let userProducts = 0;
  let skipped = 0;
  const products: NormalizedProduct[] = [];
  const byMlId = new Set<string>();

  for (const outcome of outcomes) {
    listingsSeen += outcome.listings;
    if (outcome.failure === "user-product") {
      userProducts += 1;
      continue;
    }
    if (outcome.failure === "error") {
      failed += 1;
      continue;
    }
    if (!outcome.product) {
      skipped += 1;
      continue;
    }
    // O mesmo anúncio pode vencer em dois produtos de catálogo irmãos.
    if (byMlId.has(outcome.product.mlId)) continue;
    byMlId.add(outcome.product.mlId);
    products.push(outcome.product);
  }

  const extra = await enrichFromItems(
    products.map((p) => p.mlId),
    options,
  );
  const merged = products.map((product) => {
    const item = extra.get(product.mlId);
    return item ? mergeEnrichment(product, item) : product;
  });

  return {
    products: merged,
    highlightsSeen: highlights.length,
    listingsSeen,
    skipped,
    userProducts,
    failed,
    enriched: extra.size > 0,
  };
}

/// Atalho para quem só quer os produtos.
export async function collectCategory(
  categoryId: string,
  limit = DEFAULT_LIMIT,
  options: HighlightsOptions = {},
): Promise<NormalizedProduct[]> {
  const { products } = await collectCategoryDetailed(categoryId, limit, options);
  return products;
}
