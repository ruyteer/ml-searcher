/// Coleta pelos DESTAQUES de categoria — o caminho para as watches que só têm
/// `categoryId`. Rende ~20 produtos por categoria, contra as centenas que a
/// busca por termo (`search.ts`) alcança.
///
/// Fluxo por categoria:
///   /highlights/MLB/category/{id}   -> ids de produto de catálogo
///   /products/{catalogId}           -> nome e foto (os anúncios não têm título)
///   /products/{catalogId}/items     -> os anúncios; escolhemos o mais barato
///
/// As duas últimas etapas são as mesmas da busca por termo e vivem em
/// `catalog.ts`.

import { mlRequest, isMLApiError } from "./client";
import {
  cheapestListing,
  enrichProducts,
  fetchCatalogListings,
  fetchCatalogProduct,
  normalizeListing,
} from "./catalog";
import type { CatalogOptions } from "./catalog";
import type { MLHighlightEntry, MLHighlightsResponse, NormalizedProduct } from "./types";

/// Os destaques trazem ~20 itens; este é o teto quando a watch não define um.
const DEFAULT_LIMIT = 20;

export type HighlightsOptions = CatalogOptions;

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
/// normalizados, no mesmo shape que a busca por termo entrega ao collect.ts.
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

  const enriched = await enrichProducts(products, options);

  return {
    products: enriched.products,
    highlightsSeen: highlights.length,
    listingsSeen,
    skipped,
    userProducts,
    failed,
    enriched: enriched.enriched,
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
