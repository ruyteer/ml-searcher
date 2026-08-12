/// Estratégia de coleta: uma porta única para o scraper.
///
/// Ordem de preferência:
///   1. fixtures   — sem credenciais (ou ML_FIXTURES=1)
///   2. search     — /sites/MLB/search, quando não estiver marcada como bloqueada
///   3. highlights — /highlights/{site}/category/{id}, o caminho normal hoje
///
/// A busca está bloqueada (403) para esta aplicação. Em vez de fixar isso no
/// código, o primeiro 401/403 marca a busca como indisponível por 24h e a
/// coleta cai para os destaques sem propagar erro. Passada a janela, a próxima
/// varredura testa a busca de novo — se o ML liberar, o sistema volta sozinho
/// a usar a busca, sem precisar de deploy.

import { isMLApiError } from "./client";
import { fixtureSearch, isFixtureMode } from "./fixtures";
import { collectCategoryDetailed } from "./highlights";
import { searchWatchDetailed } from "./search";
import { normalize } from "./types";
import type { NormalizedProduct } from "./types";
import type { WatchQuery } from "./search";

export type CollectionSource = "fixtures" | "search" | "highlights";

/// Por que uma watch não pôde ser coletada. Não é falha: é uma limitação
/// conhecida da API que o painel precisa mostrar.
export type CollectSkipReason = "SEARCH_BLOCKED_NO_CATEGORY";

export interface CollectOptions {
  signal?: AbortSignal;
  siteId?: string;
}

export interface CollectResult {
  products: NormalizedProduct[];
  source: CollectionSource;
  /// Anúncios avaliados para chegar nesses produtos (destaques: soma de
  /// /products/{id}/items; busca: total informado pela API).
  listingsSeen: number;
  /// Produtos de catálogo em destaque que não renderam anúncio elegível.
  skippedCatalog: number;
  /// Destaques USER_PRODUCT — sem página de catálogo, logo sem título/foto.
  userProductCatalog: number;
  /// Produtos de catálogo inacessíveis por erro de rede/servidor.
  failedCatalog: number;
  /// Preenchido quando não havia caminho de coleta possível.
  skipped: CollectSkipReason | null;
  /// Frase pronta para a linha de log da varredura.
  note: string;
}

// --------------------------------------------------- estado do bloqueio

const SEARCH_BLOCK_MS = 24 * 60 * 60 * 1000;

/// Timestamp até quando a busca é considerada indisponível. 0 = liberada.
let searchBlockedUntil = 0;

export function isSearchBlocked(now: number = Date.now()): boolean {
  return searchBlockedUntil > now;
}

export function getSearchBlockedUntil(): Date | null {
  return isSearchBlocked() ? new Date(searchBlockedUntil) : null;
}

/// Força um novo teste da busca na próxima coleta (botão do painel).
export function resetSearchBlock(): void {
  searchBlockedUntil = 0;
}

function markSearchBlocked(reason: string): void {
  searchBlockedUntil = Date.now() + SEARCH_BLOCK_MS;
  console.warn(
    `[ml/collect] busca indisponível (${reason}); usando destaques pelas próximas 24h.`,
  );
}

/// Qual fonte seria usada agora, sem considerar uma watch específica.
export async function getCollectionMode(): Promise<CollectionSource> {
  if (await isFixtureMode()) return "fixtures";
  return isSearchBlocked() ? "highlights" : "search";
}

// ------------------------------------------------------------- coleta

function emptyResult(
  source: CollectionSource,
  skipped: CollectSkipReason,
  note: string,
): CollectResult {
  return {
    products: [],
    source,
    listingsSeen: 0,
    skippedCatalog: 0,
    userProductCatalog: 0,
    failedCatalog: 0,
    skipped,
    note,
  };
}

/// Um 401/403 na busca é o sintoma do bloqueio; qualquer outro erro é um
/// problema real e deve subir para o chamador.
function isBlockingError(err: unknown): boolean {
  return isMLApiError(err) && (err.status === 401 || err.status === 403);
}

export async function collectForWatch(
  watch: WatchQuery,
  options: CollectOptions = {},
): Promise<CollectResult> {
  const limit = watch.limit && watch.limit > 0 ? Math.floor(watch.limit) : 100;

  // 1. fixtures
  if (await isFixtureMode()) {
    const items = fixtureSearch({
      categoryId: watch.categoryId,
      query: watch.query,
      limit,
    });
    const products = items.map(normalize);
    return {
      products,
      source: "fixtures",
      listingsSeen: products.length,
      skippedCatalog: 0,
      userProductCatalog: 0,
      failedCatalog: 0,
      skipped: null,
      note: `fonte=fixtures, ${products.length} produto(s) de exemplo`,
    };
  }

  // 2. busca — só quando não está marcada como bloqueada.
  if (!isSearchBlocked() && (watch.categoryId || watch.query)) {
    try {
      const found = await searchWatchDetailed(watch, {
        signal: options.signal,
        siteId: options.siteId,
      });
      return {
        products: found.products,
        source: "search",
        listingsSeen: found.total || found.products.length,
        skippedCatalog: 0,
        userProductCatalog: 0,
        failedCatalog: 0,
        skipped: null,
        note: `fonte=busca, ${found.products.length} produto(s) de ${found.total} resultado(s)`,
      };
    } catch (err) {
      if (!isBlockingError(err)) throw err;
      markSearchBlocked(isMLApiError(err) ? `HTTP ${err.status}` : "403");
    }
  }

  // 3. destaques — precisam de categoria.
  if (!watch.categoryId) {
    return emptyResult(
      "highlights",
      "SEARCH_BLOCKED_NO_CATEGORY",
      "pulada: só tem termo de busca e a busca do ML está bloqueada (403)",
    );
  }

  const collected = await collectCategoryDetailed(watch.categoryId, limit, {
    signal: options.signal,
    siteId: options.siteId,
  });

  const parts = [
    `fonte=destaques, ${collected.highlightsSeen} produto(s) de catálogo`,
    `${collected.listingsSeen} anúncio(s) avaliado(s)`,
  ];
  if (collected.skipped > 0) parts.push(`${collected.skipped} sem anúncio elegível`);
  if (collected.userProducts > 0) {
    parts.push(`${collected.userProducts} anúncio(s) próprio(s) sem catálogo`);
  }
  if (collected.failed > 0) parts.push(`${collected.failed} inacessível(is)`);

  return {
    products: collected.products,
    source: "highlights",
    listingsSeen: collected.listingsSeen,
    skippedCatalog: collected.skipped,
    userProductCatalog: collected.userProducts,
    failedCatalog: collected.failed,
    skipped: null,
    note: parts.join(", "),
  };
}
