/// Busca paginada de itens para uma Watch.

import { getCredentials, mlRequest, MLApiError } from "./client";
import { fixtureSearch, isFixtureMode } from "./fixtures";
import { normalize } from "./types";
import type { MLItem, MLMultiGetEntry, MLSearchResponse, NormalizedProduct } from "./types";

/// A API pagina de 50 em 50.
const PAGE_SIZE = 50;
/// O ML corta a busca em offset 1000 — pedir além disso devolve 400.
const MAX_OFFSET = 1000;
const DEFAULT_LIMIT = 100;
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

export interface SearchResult {
  products: NormalizedProduct[];
  /// Total informado pela API (0 em modo fixture).
  total: number;
  fixture: boolean;
}

function clampLimit(limit: number | null | undefined): number {
  const n = limit && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
  return Math.min(n, MAX_OFFSET);
}

/// Busca os itens de uma watch, deduplicados por mlId.
export async function searchWatch(
  watch: WatchQuery,
  options: SearchOptions = {},
): Promise<NormalizedProduct[]> {
  const { products } = await searchWatchDetailed(watch, options);
  return products;
}

export async function searchWatchDetailed(
  watch: WatchQuery,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const limit = clampLimit(watch.limit);

  if (await isFixtureMode()) {
    const items = fixtureSearch({
      categoryId: watch.categoryId,
      query: watch.query,
      limit,
    });
    return { products: dedupe(items), total: items.length, fixture: true };
  }

  const creds = await getCredentials();
  if (!creds) {
    throw new MLApiError({
      status: 0,
      code: "NO_CREDENTIALS",
      message: "Credenciais do Mercado Livre não configuradas.",
    });
  }
  if (!watch.categoryId && !watch.query) {
    throw new MLApiError({
      status: 400,
      code: "HTTP_ERROR",
      message: `Watch "${watch.label ?? watch.id ?? "?"}" não tem categoria nem termo de busca.`,
    });
  }

  const siteId = options.siteId ?? creds.siteId;
  const collected: MLItem[] = [];
  let total = 0;
  let offset = 0;

  while (collected.length < limit && offset < MAX_OFFSET) {
    const pageSize = Math.min(PAGE_SIZE, limit - collected.length, MAX_OFFSET - offset);
    if (pageSize <= 0) break;

    const page = await mlRequest<MLSearchResponse>(`/sites/${siteId}/search`, {
      searchParams: {
        category: watch.categoryId ?? undefined,
        q: watch.query ?? undefined,
        offset,
        limit: pageSize,
      },
      signal: options.signal,
    });

    total = page.paging?.total ?? total;
    const results = Array.isArray(page.results) ? page.results : [];
    collected.push(...results);

    // Fim natural da lista: a página veio incompleta ou já cobrimos o total.
    if (results.length < pageSize) break;
    offset += pageSize;
    if (total > 0 && offset >= total) break;
  }

  return { products: dedupe(collected).slice(0, limit), total, fixture: false };
}

function dedupe(items: MLItem[]): NormalizedProduct[] {
  const seen = new Map<string, NormalizedProduct>();
  for (const item of items) {
    if (!item?.id) continue;
    if (!seen.has(item.id)) seen.set(item.id, normalize(item));
  }
  return [...seen.values()];
}

/// Multiget /items — a busca costuma omitir sold_quantity, então este é o
/// caminho para enriquecer os itens quando a precisão importa.
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
    const chunk = ids.slice(i, i + MULTIGET_CHUNK);
    const entries = await mlRequest<MLMultiGetEntry[]>("/items", {
      searchParams: { ids: chunk.join(",") },
      signal: options.signal,
    });
    for (const entry of entries) {
      if (entry.code === 200 && entry.body?.id) out.push(normalize(entry.body));
    }
  }
  return out;
}
