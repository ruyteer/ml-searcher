/// Busca por termo no CATÁLOGO do Mercado Livre (/products/search).
///
/// O antigo /sites/{site}/search foi descontinuado (403 permanente, fora da
/// documentação desde abril de 2025) e não existe mais aqui. O substituto é
/// /products/search, medido em campo:
///
///   GET /products/search?status=active&site_id=MLB&q=<termo>&limit=50&offset=<n>
///     -> { keywords, paging: { total, limit, offset, last }, results, query_type }
///
///   - o parâmetro é `q`; `keywords=` devolve 400;
///   - `domain_id=MLB-RAZOR_BLADES` filtra de verdade;
///   - `category_id=` é IGNORADO pelo endpoint, não adianta passar;
///   - NÃO há teto de offset 1000 (offset 950 e 1000 devolvem 50 itens);
///   - `buy_box_winner` vem sempre null: o resultado NÃO tem preço.
///
/// Como não vem preço, cada produto de catálogo ainda precisa de
/// /products/{id}/items para virar um anúncio com preço — a mesma etapa que os
/// destaques fazem, compartilhada em `catalog.ts`. O que a busca economiza é a
/// chamada /products/{id}: nome, foto e domínio já vêm no resultado.
///
/// FILTRO DE NICHO: o catálogo é amplo e `q=shampoo` traz "Shampoo para
/// veículos Renault". Por isso todo produto tem a categoria do anúncio escolhido
/// conferida contra a árvore de Beleza e Cuidado Pessoal (MLB1246) e o que cair
/// fora é descartado. Ver `filterNiche` abaixo.

import { getCredentials, mlRequest, MLApiError, isMLApiError } from "./client";
import { BEAUTY_ROOT, isUnderCategory } from "./categories";
import {
  catalogProductFromSearch,
  cheapestListing,
  enrichProducts,
  fetchCatalogListings,
  normalizeListing,
} from "./catalog";
import { fixtureSearch, isFixtureMode } from "./fixtures";
import { normalize } from "./types";
import type {
  MLCatalogListing,
  MLCatalogSearchItem,
  MLMultiGetEntry,
  MLProductSearchResponse,
  NormalizedProduct,
} from "./types";

/// Máximo aceito por página em /products/search.
const PAGE_SIZE = 50;
const DEFAULT_LIMIT = 100;
/// Travas de segurança: nenhuma watch deve varrer o catálogo inteiro, e a
/// paginação não pode girar para sempre se o ML repetir resultados.
const MAX_CATALOG_ITEMS = 1_000;
const MAX_PAGES = 40;
/// Quantos produtos de catálogo resolvemos em paralelo. Entre lotes o
/// resultado do filtro de nicho já vale, e domínio reprovado é pulado de graça.
const RESOLVE_BATCH = 25;
/// Limite do multiget /items?ids=
const MULTIGET_CHUNK = 20;

/// Shape mínimo de Watch de que a busca precisa (evita acoplar ao Prisma).
export interface WatchQuery {
  id?: string;
  label?: string;
  categoryId?: string | null;
  query?: string | null;
  limit?: number | null;
}

export interface SearchOptions {
  signal?: AbortSignal;
  /// Sobrescreve o site das settings (padrão MLB).
  siteId?: string;
}

export interface SearchProductsInput extends SearchOptions {
  /// Termo de busca. Vai no parâmetro `q`.
  q: string;
  /// Domínio de catálogo, ex. MLB-RAZOR_BLADES. Filtra na própria API.
  domainId?: string | null;
  /// Teto de produtos de CATÁLOGO avaliados (não de produtos entregues:
  /// boa parte deles não tem anúncio vencedor).
  limit?: number | null;
  /// Raiz da árvore de categorias aceita. `null` desliga o filtro de nicho.
  nicheRoot?: string | null;
}

export interface SearchResult {
  products: NormalizedProduct[];
  /// Total informado pela API (0 em modo fixture ou termo sem catálogo).
  total: number;
  /// Produtos de catálogo trazidos pela busca e avaliados.
  catalogSeen: number;
  /// Anúncios avaliados somando todos os produtos de catálogo.
  listingsSeen: number;
  /// Produtos de catálogo sem anúncio vencedor (404 "No winners found").
  withoutListings: number;
  /// Descartados por estarem fora da árvore de nicho.
  offNiche: number;
  /// Produtos de catálogo que falharam por rede/5xx.
  failed: number;
  fixture: boolean;
  /// Frase curta para a linha de log quando há algo fora do comum.
  note: string | null;
}

function clampLimit(limit: number | null | undefined): number {
  const n = limit && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
  return Math.min(n, MAX_CATALOG_ITEMS);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ------------------------------------------------------------- paginação

/// Percorre /products/search de 50 em 50 até juntar `limit` produtos de
/// catálogo distintos. Para cedo quando a página vem incompleta ou quando o
/// total informado pela API já foi coberto.
export async function searchCatalogItems(
  q: string,
  limit: number,
  input: SearchProductsInput,
): Promise<{ items: MLCatalogSearchItem[]; total: number }> {
  const items: MLCatalogSearchItem[] = [];
  const seen = new Set<string>();
  let total = 0;
  let offset = 0;

  for (let pageNum = 0; pageNum < MAX_PAGES && items.length < limit; pageNum += 1) {
    const pageSize = Math.min(PAGE_SIZE, limit - items.length);
    const page = await mlRequest<MLProductSearchResponse>("/products/search", {
      searchParams: {
        status: "active",
        site_id: input.siteId ?? "MLB",
        q,
        domain_id: input.domainId ?? undefined,
        limit: pageSize,
        offset,
      },
      signal: input.signal,
    });

    total = page.paging?.total ?? total;
    const results = Array.isArray(page.results) ? page.results : [];
    for (const result of results) {
      if (!result?.id || seen.has(result.id)) continue;
      seen.add(result.id);
      items.push(result);
    }

    if (results.length < pageSize) break;
    offset += results.length;
    if (total > 0 && offset >= total) break;
  }

  return { items: items.slice(0, limit), total };
}

// ---------------------------------------------------------- filtro de nicho

type NicheVerdict = "in" | "out" | "unknown";

/// Decide se a categoria do anúncio está dentro do nicho. Uma categoria que
/// não pôde ser resolvida vira "unknown" e o produto é MANTIDO: perder um item
/// bom por uma falha de rede é pior que deixar passar um duvidoso.
async function judgeCategory(
  categoryId: string | null,
  nicheRoot: string,
  signal?: AbortSignal,
): Promise<NicheVerdict> {
  if (!categoryId) return "unknown";
  const inside = await isUnderCategory(categoryId, nicheRoot, { signal });
  if (inside === null) return "unknown";
  return inside ? "in" : "out";
}

// -------------------------------------------------------- resolução do preço

interface ResolveOutcome {
  product: NormalizedProduct | null;
  listings: number;
  /// Domínio do produto de catálogo, para alimentar o atalho por domínio.
  domainId: string | null;
  verdict: NicheVerdict;
  failed: boolean;
}

async function resolveCatalogItem(
  item: MLCatalogSearchItem,
  nicheRoot: string | null,
  options: SearchOptions,
): Promise<ResolveOutcome> {
  const product = catalogProductFromSearch(item);
  const domainId = product.domainId;

  let listings: MLCatalogListing[];
  try {
    listings = await fetchCatalogListings(item.id, options);
  } catch (err) {
    if (isMLApiError(err) && err.code === "ABORTED") throw err;
    return { product: null, listings: 0, domainId, verdict: "unknown", failed: true };
  }

  const best = cheapestListing(listings);
  if (!best) {
    return { product: null, listings: listings.length, domainId, verdict: "unknown", failed: false };
  }

  const verdict = nicheRoot
    ? await judgeCategory(best.category_id ?? null, nicheRoot, options.signal)
    : "in";
  if (verdict === "out") {
    return { product: null, listings: listings.length, domainId, verdict, failed: false };
  }

  return {
    product: normalizeListing(best, product),
    listings: listings.length,
    domainId,
    verdict,
    failed: false,
  };
}

// ------------------------------------------------------------- busca pública

/// Busca por termo, já com preço e filtrada pelo nicho.
export async function searchProducts(input: SearchProductsInput): Promise<SearchResult> {
  const q = input.q.trim();
  const limit = clampLimit(input.limit);
  const nicheRoot = input.nicheRoot === null ? null : (input.nicheRoot ?? BEAUTY_ROOT);
  const options: SearchOptions = { signal: input.signal, siteId: input.siteId };

  if (await isFixtureMode()) {
    const items = fixtureSearch({ query: q, limit }).map(normalize);
    return {
      products: items,
      total: items.length,
      catalogSeen: items.length,
      listingsSeen: items.length,
      withoutListings: 0,
      offNiche: 0,
      failed: 0,
      fixture: true,
      note: null,
    };
  }

  const creds = await getCredentials();
  if (!creds) {
    throw new MLApiError({
      status: 0,
      code: "NO_CREDENTIALS",
      message: "Credenciais do Mercado Livre não configuradas.",
    });
  }
  if (!q) {
    throw new MLApiError({
      status: 400,
      code: "HTTP_ERROR",
      message: "Busca por termo sem termo (q vazio).",
    });
  }

  const searchOptions: SearchProductsInput = {
    ...input,
    q,
    siteId: input.siteId ?? creds.siteId,
  };
  const { items, total } = await searchCatalogItems(q, limit, searchOptions);

  // Termo sem produto de catálogo é caso normal (ex. "minoxidil" -> total 0),
  // não erro.
  if (items.length === 0) {
    return {
      products: [],
      total,
      catalogSeen: 0,
      listingsSeen: 0,
      withoutListings: 0,
      offNiche: 0,
      failed: 0,
      fixture: false,
      note: `termo "${q}" não tem produto de catálogo no Mercado Livre`,
    };
  }

  // Atalho por domínio, válido só dentro desta busca: quando um domínio já se
  // mostrou fora do nicho (ex. MLB-VEHICLE_SHAMPOOS em q=shampoo), os próximos
  // produtos dele são descartados sem gastar chamada.
  const rejectedDomains = new Set<string>();

  const products: NormalizedProduct[] = [];
  const byMlId = new Set<string>();
  let listingsSeen = 0;
  let withoutListings = 0;
  let offNiche = 0;
  let failed = 0;

  for (const batch of chunk(items, RESOLVE_BATCH)) {
    const pending: MLCatalogSearchItem[] = [];
    for (const item of batch) {
      if (item.domain_id && rejectedDomains.has(item.domain_id)) {
        offNiche += 1;
        continue;
      }
      pending.push(item);
    }
    if (pending.length === 0) continue;

    const outcomes = await Promise.all(
      pending.map((item) => resolveCatalogItem(item, nicheRoot, options)),
    );

    for (const outcome of outcomes) {
      listingsSeen += outcome.listings;
      if (outcome.failed) {
        failed += 1;
        continue;
      }
      if (outcome.verdict === "out") {
        offNiche += 1;
        if (outcome.domainId) rejectedDomains.add(outcome.domainId);
        continue;
      }
      if (!outcome.product) {
        withoutListings += 1;
        continue;
      }
      // O mesmo anúncio pode vencer em dois produtos de catálogo irmãos.
      if (byMlId.has(outcome.product.mlId)) continue;
      byMlId.add(outcome.product.mlId);
      products.push(outcome.product);
    }
  }

  const enriched = await enrichProducts(products, options);

  // Filtro que derrubou tudo: melhor devolver vazio com o motivo do que
  // encher o painel com produto fora do nicho.
  const note =
    enriched.products.length === 0 && offNiche > 0
      ? `todos os ${offNiche} produto(s) de "${q}" ficaram fora do nicho`
      : null;

  return {
    products: enriched.products,
    total,
    catalogSeen: items.length,
    listingsSeen,
    withoutListings,
    offNiche,
    failed,
    fixture: false,
    note,
  };
}

/// Busca os produtos de uma watch pelo termo dela.
export async function searchWatchDetailed(
  watch: WatchQuery,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const q = watch.query?.trim() ?? "";
  if (!q) {
    throw new MLApiError({
      status: 400,
      code: "HTTP_ERROR",
      message: `Watch "${watch.label ?? watch.id ?? "?"}" não tem termo de busca.`,
    });
  }
  return searchProducts({ q, limit: watch.limit, ...options });
}

export async function searchWatch(
  watch: WatchQuery,
  options: SearchOptions = {},
): Promise<NormalizedProduct[]> {
  const { products } = await searchWatchDetailed(watch, options);
  return products;
}

// ----------------------------------------------------------------- multiget

/// Multiget /items — hoje responde 403 para esta aplicação, mas segue aqui
/// para quando o acesso for liberado.
export async function fetchItems(
  ids: string[],
  options: SearchOptions = {},
): Promise<NormalizedProduct[]> {
  if (ids.length === 0) return [];
  if (await isFixtureMode()) {
    return fixtureSearch({}).filter((item) => ids.includes(item.id)).map(normalize);
  }

  const out: NormalizedProduct[] = [];
  for (let i = 0; i < ids.length; i += MULTIGET_CHUNK) {
    const slice = ids.slice(i, i + MULTIGET_CHUNK);
    const entries = await mlRequest<MLMultiGetEntry[]>("/items", {
      searchParams: { ids: slice.join(",") },
      signal: options.signal,
    });
    for (const entry of entries) {
      if (entry.code === 200 && entry.body?.id) out.push(normalize(entry.body));
    }
  }
  return out;
}
