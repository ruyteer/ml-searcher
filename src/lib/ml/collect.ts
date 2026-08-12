/// Estratégia de coleta: uma porta única para o scraper.
///
/// Ordem de escolha da fonte:
///   1. fixtures   — sem credenciais (ou ML_FIXTURES=1)
///   2. busca por termo (/products/search) — quando a watch tem `query`.
///      É o caminho preferido: alcança centenas de produtos de catálogo por
///      termo, contra os ~20 dos destaques.
///   3. destaques de categoria (/highlights/{site}/category/{id}) — quando a
///      watch só tem `categoryId`.
///   4. watch com os dois: tenta a busca e, se vier vazia, cai nos destaques.
///
/// O antigo /sites/{site}/search foi descontinuado de vez pelo ML, então não
/// existe mais nem o endpoint nem o bloqueio temporário que existia por causa
/// dele.

import { fixtureSearch, isFixtureMode } from "./fixtures";
import { collectCategoryDetailed } from "./highlights";
import { searchProducts } from "./search";
import { normalize } from "./types";
import type { NormalizedProduct } from "./types";
import type { WatchQuery } from "./search";

export type CollectionSource = "fixtures" | "search" | "highlights";

/// Por que uma watch não pôde ser coletada. Não é falha: é configuração
/// incompleta que o painel precisa mostrar.
export type CollectSkipReason = "NO_QUERY_NO_CATEGORY";

/// WatchQuery de search.ts ainda não conhece domainId. Estende aqui em vez de
/// alterar aquele módulo: qualquer Watch do Prisma (que já tem a coluna)
/// continua batendo estruturalmente com este tipo.
export interface CollectWatchQuery extends WatchQuery {
  /// Domínio de catálogo do ML (ex. MLB-RAZOR_BLADES). Quando preenchido,
  /// restringe a busca por termo na própria API do Mercado Livre.
  domainId?: string | null;
}

export interface CollectOptions {
  signal?: AbortSignal;
  siteId?: string;
}

export interface CollectResult {
  products: NormalizedProduct[];
  source: CollectionSource;
  /// Anúncios avaliados para chegar nesses produtos (soma de
  /// /products/{id}/items nos dois caminhos reais).
  listingsSeen: number;
  /// Produtos de catálogo que não renderam anúncio elegível.
  skippedCatalog: number;
  /// Destaques USER_PRODUCT — sem página de catálogo, logo sem título/foto.
  userProductCatalog: number;
  /// Produtos de catálogo inacessíveis por erro de rede/servidor.
  failedCatalog: number;
  /// Descartados por caírem fora da árvore de Beleza e Cuidado Pessoal.
  offNiche: number;
  /// Preenchido quando não havia caminho de coleta possível.
  skipped: CollectSkipReason | null;
  /// Frase pronta para a linha de log da varredura.
  note: string;
}

/// Qual fonte seria usada agora, sem considerar uma watch específica.
/// Watch com termo usa a busca; watch só com categoria usa os destaques.
export async function getCollectionMode(): Promise<CollectionSource> {
  if (await isFixtureMode()) return "fixtures";
  return "search";
}

// ------------------------------------------------------------------- coleta

const BASE: Omit<CollectResult, "products" | "source" | "note"> = {
  listingsSeen: 0,
  skippedCatalog: 0,
  userProductCatalog: 0,
  failedCatalog: 0,
  offNiche: 0,
  skipped: null,
};

export async function collectForWatch(
  watch: CollectWatchQuery,
  options: CollectOptions = {},
): Promise<CollectResult> {
  const limit = watch.limit && watch.limit > 0 ? Math.floor(watch.limit) : 100;
  const query = watch.query?.trim() || null;
  const categoryId = watch.categoryId?.trim() || null;
  const domainId = watch.domainId?.trim() || null;

  // 1. fixtures
  if (await isFixtureMode()) {
    const items = fixtureSearch({ categoryId, query, limit });
    const products = items.map(normalize);
    return {
      ...BASE,
      products,
      source: "fixtures",
      listingsSeen: products.length,
      note: `fonte=fixtures, ${products.length} produto(s) de exemplo`,
    };
  }

  // 2. busca por termo — caminho preferido.
  if (query) {
    const found = await searchProducts({
      q: query,
      domainId,
      limit,
      signal: options.signal,
      siteId: options.siteId,
    });

    const parts = [
      domainId
        ? `fonte=busca por termo "${query}" restrita ao domínio ${domainId}`
        : `fonte=busca por termo "${query}"`,
      `${found.catalogSeen} produto(s) de catálogo de ${found.total} resultado(s)`,
      `${found.listingsSeen} anúncio(s) avaliado(s)`,
    ];
    // O domínio filtra na origem, mas o filtro de nicho por categoria segue
    // valendo por cima: cinto e suspensório, um domínio errado não passa.
    if (domainId) parts.push("filtro de nicho por categoria mantido como segunda camada");
    if (found.withoutListings > 0) parts.push(`${found.withoutListings} sem anúncio vencedor`);
    if (found.offNiche > 0) parts.push(`${found.offNiche} fora do nicho descartado(s)`);
    if (found.failed > 0) parts.push(`${found.failed} inacessível(is)`);
    if (found.note) parts.push(found.note);

    if (found.products.length > 0 || !categoryId) {
      return {
        ...BASE,
        products: found.products,
        source: "search",
        listingsSeen: found.listingsSeen,
        skippedCatalog: found.withoutListings,
        failedCatalog: found.failed,
        offNiche: found.offNiche,
        note: parts.join(", "),
      };
    }

    // 4. busca vazia numa watch que também tem categoria: cai nos destaques.
    const fallback = await collectCategoryDetailed(categoryId, limit, {
      signal: options.signal,
      siteId: options.siteId,
    });
    return {
      ...BASE,
      products: fallback.products,
      source: "highlights",
      listingsSeen: found.listingsSeen + fallback.listingsSeen,
      skippedCatalog: found.withoutListings + fallback.skipped,
      userProductCatalog: fallback.userProducts,
      failedCatalog: found.failed + fallback.failed,
      offNiche: found.offNiche,
      note:
        `${parts.join(", ")}; busca vazia, caiu para os destaques da categoria ` +
        `${categoryId}: ${fallback.highlightsSeen} produto(s) de catálogo, ` +
        `${fallback.listingsSeen} anúncio(s) avaliado(s)`,
    };
  }

  // 3. destaques de categoria.
  if (!categoryId) {
    return {
      ...BASE,
      products: [],
      source: "search",
      skipped: "NO_QUERY_NO_CATEGORY",
      note: "pulada: a watch não tem termo de busca nem categoria",
    };
  }

  const collected = await collectCategoryDetailed(categoryId, limit, {
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
    ...BASE,
    products: collected.products,
    source: "highlights",
    listingsSeen: collected.listingsSeen,
    skippedCatalog: collected.skipped,
    userProductCatalog: collected.userProducts,
    failedCatalog: collected.failed,
    note: parts.join(", "),
  };
}
