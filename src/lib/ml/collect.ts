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
import { fetchCatalogProduct } from "./catalog";
import {
  BEAUTY_ROOT,
  classifyCategory,
  isUnderCategory,
  tipoDeProdutoForaDoNicho,
  tituloForaDoNicho,
} from "./categories";
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

/// Por que um produto foi descartado pela peneira de nicho.
export type MotivoDescarte =
  | "ramo-bloqueado"
  | "fora-do-cuidado-masculino"
  | "tipo-de-produto"
  | "titulo";

export const MOTIVO_LABEL: Record<MotivoDescarte, string> = {
  "ramo-bloqueado": "ramo bloqueado (maquiagem, manicure, depilação, farmácia)",
  "fora-do-cuidado-masculino": "categoria fora do cuidado pessoal masculino",
  "tipo-de-produto": "tipo de produto fora do nicho",
  titulo: "título de produto feminino ou íntimo",
};

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
  /// Descartados por caírem fora do nicho de cuidado pessoal masculino.
  offNiche: number;
  /// Quantos caíram por cada motivo — é o que o log da varredura mostra.
  offNicheByReason: Record<MotivoDescarte, number>;
  /// Mantidos apesar da dúvida (categoria não resolvida). Nunca descartamos
  /// por falha de rede: melhor um duvidoso a mais do que uma oferta boa a menos.
  offNicheDuvidosos: number;
  /// Alguns títulos descartados, para o usuário conferir se a peneira exagerou.
  offNicheAmostras: string[];
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

function zeroPorMotivo(): Record<MotivoDescarte, number> {
  return {
    "ramo-bloqueado": 0,
    "fora-do-cuidado-masculino": 0,
    "tipo-de-produto": 0,
    titulo: 0,
  };
}

const BASE: Omit<CollectResult, "products" | "source" | "note"> = {
  listingsSeen: 0,
  skippedCatalog: 0,
  userProductCatalog: 0,
  failedCatalog: 0,
  offNiche: 0,
  offNicheByReason: zeroPorMotivo(),
  offNicheDuvidosos: 0,
  offNicheAmostras: [],
  skipped: null,
};

// -------------------------------------------------------- peneira de nicho

/// Quantos títulos descartados guardamos para o log. O suficiente para o
/// usuário perceber que a peneira apertou demais, sem inundar a linha.
const MAX_AMOSTRAS = 5;

/// Tipo de produto (domain_id) de um produto de catálogo, com cache no módulo:
/// a mesma varredura costuma repetir catálogo, e a chamada só acontece quando
/// a categoria sozinha não fecha o veredito.
const domainCache = new Map<string, string | null>();

async function tipoDeProduto(
  catalogId: string | null,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!catalogId) return null;
  const hit = domainCache.get(catalogId);
  if (hit !== undefined) return hit;
  try {
    const { domainId } = await fetchCatalogProduct(catalogId, { signal });
    domainCache.set(catalogId, domainId);
    return domainId;
  } catch {
    domainCache.set(catalogId, null);
    return null;
  }
}

export interface PeneiraResult {
  products: NormalizedProduct[];
  descartados: number;
  porMotivo: Record<MotivoDescarte, number>;
  duvidosos: number;
  amostras: string[];
}

/// Deixa passar só o que é cuidado pessoal masculino.
///
/// Três camadas, da mais confiável para a mais grosseira:
///   1. categoria do anúncio contra a lista de permitidas e a de bloqueadas
///      (`classifyCategory`). É o filtro que realmente segura maquiagem,
///      manicure, depilação e o "Cuidado Sexual" da Farmácia.
///   2. tipo de produto (domain_id), mais específico que a categoria. Custa
///      uma chamada, então só é consultado quando a categoria não fecha o
///      veredito sozinha — categoria não resolvida ou categoria escolhida na
///      mão pelo usuário.
///   3. palavra no título, a última rede. Curta de propósito e com salvo-conduto
///      para qualquer título que se declare masculino: produto unissex de
///      cabelo e pele é legítimo aqui.
///
/// Dúvida NUNCA descarta: categoria que não resolveu passa e vira contagem de
/// "duvidosos" no log.
export async function peneirarNicho(
  products: NormalizedProduct[],
  options: { watchCategoryId?: string | null; signal?: AbortSignal } = {},
): Promise<PeneiraResult> {
  // A categoria monitorada vale como permissão explícita do usuário, MENOS
  // quando é a raiz "Beleza e Cuidado Pessoal": aceitar a raiz reabriria
  // exatamente o buraco que deixava passar maquiagem e gel lubrificante.
  const escolha = options.watchCategoryId?.trim() || null;
  const watchCategoryId = escolha && escolha !== BEAUTY_ROOT ? escolha : null;
  const porMotivo = zeroPorMotivo();
  const amostras: string[] = [];
  const mantidos: NormalizedProduct[] = [];
  let duvidosos = 0;

  function descartar(motivo: MotivoDescarte, product: NormalizedProduct) {
    porMotivo[motivo] += 1;
    if (amostras.length < MAX_AMOSTRAS) {
      amostras.push(`${product.title} [${MOTIVO_LABEL[motivo]}]`);
    }
  }

  for (const product of products) {
    const standing = product.categoryId
      ? await classifyCategory(product.categoryId, { signal: options.signal })
      : null;

    if (standing === "fora") {
      descartar("ramo-bloqueado", product);
      continue;
    }

    // Categoria dentro de Beleza mas fora do conjunto masculino. A categoria
    // que o próprio usuário monitora vale como permissão: se ele ligou aquele
    // ramo de propósito, o filtro não desautoriza a escolha dele.
    let precisaDoTipo = standing === null;
    if (standing === "neutro") {
      const escolhaDoUsuario =
        watchCategoryId !== null &&
        product.categoryId !== null &&
        (await isUnderWatchCategory(product.categoryId, watchCategoryId, options.signal));
      if (!escolhaDoUsuario) {
        descartar("fora-do-cuidado-masculino", product);
        continue;
      }
      precisaDoTipo = true;
    }
    if (standing === null) duvidosos += 1;

    if (precisaDoTipo) {
      const domainId = await tipoDeProduto(product.catalogId, options.signal);
      if (tipoDeProdutoForaDoNicho(domainId)) {
        descartar("tipo-de-produto", product);
        continue;
      }
    }

    if (tituloForaDoNicho(product.title)) {
      descartar("titulo", product);
      continue;
    }

    mantidos.push(product);
  }

  const descartados = Object.values(porMotivo).reduce((a, b) => a + b, 0);
  return { products: mantidos, descartados, porMotivo, duvidosos, amostras };
}

async function isUnderWatchCategory(
  categoryId: string,
  watchCategoryId: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (categoryId === watchCategoryId) return true;
  const inside = await isUnderCategory(categoryId, watchCategoryId, { signal });
  return inside === true;
}

/// Junta a peneira ao resultado e devolve a frase pronta para o log.
function comPeneira(
  result: Omit<CollectResult, "offNicheByReason" | "offNicheDuvidosos" | "offNicheAmostras">,
  peneira: PeneiraResult,
  origem: string,
): CollectResult {
  const partes: string[] = [];
  for (const [motivo, n] of Object.entries(peneira.porMotivo) as [MotivoDescarte, number][]) {
    if (n > 0) partes.push(`${n} por ${MOTIVO_LABEL[motivo]}`);
  }
  if (peneira.duvidosos > 0) {
    partes.push(`${peneira.duvidosos} mantido(s) na dúvida (categoria não resolvida)`);
  }

  let note = result.note;
  if (partes.length > 0) {
    note += `; peneira de nicho: ${peneira.descartados} descartado(s) (${partes.join(", ")})`;
    if (peneira.amostras.length > 0) note += `; exemplos: ${peneira.amostras.join(" | ")}`;
    console.log(`[nicho] ${origem}: ${partes.join(", ")}`);
    for (const amostra of peneira.amostras) console.log(`[nicho]   descartado: ${amostra}`);
  }

  return {
    ...result,
    products: peneira.products,
    offNiche: result.offNiche + peneira.descartados,
    offNicheByReason: peneira.porMotivo,
    offNicheDuvidosos: peneira.duvidosos,
    offNicheAmostras: peneira.amostras,
    note,
  };
}

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
      const peneira = await peneirarNicho(found.products, {
        watchCategoryId: categoryId,
        signal: options.signal,
      });
      return comPeneira(
        {
          ...BASE,
          products: found.products,
          source: "search",
          listingsSeen: found.listingsSeen,
          skippedCatalog: found.withoutListings,
          failedCatalog: found.failed,
          offNiche: found.offNiche,
          note: parts.join(", "),
        },
        peneira,
        `busca por termo "${query}"`,
      );
    }

    // 4. busca vazia numa watch que também tem categoria: cai nos destaques.
    const fallback = await collectCategoryDetailed(categoryId, limit, {
      signal: options.signal,
      siteId: options.siteId,
    });
    const peneiraFallback = await peneirarNicho(fallback.products, {
      watchCategoryId: categoryId,
      signal: options.signal,
    });
    return comPeneira(
      {
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
      },
      peneiraFallback,
      `destaques de ${categoryId}`,
    );
  }

  // 3. destaques de categoria.
  if (!categoryId) {
    return {
      ...BASE,
      products: [],
      source: "search",
      skipped: "NO_QUERY_NO_CATEGORY",
      note: "pulada: a categoria monitorada não tem termo de busca nem categoria",
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

  // Os destaques de categoria não passam por nenhum filtro na origem, então é
  // aqui que a peneira faz mais diferença: uma categoria de maquiagem ligada
  // por engano deixava de entregar produto feminino direto no painel.
  const peneira = await peneirarNicho(collected.products, {
    watchCategoryId: categoryId,
    signal: options.signal,
  });

  return comPeneira(
    {
      ...BASE,
      products: collected.products,
      source: "highlights",
      listingsSeen: collected.listingsSeen,
      skippedCatalog: collected.skipped,
      userProductCatalog: collected.userProducts,
      failedCatalog: collected.failed,
      note: parts.join(", "),
    },
    peneira,
    `destaques de ${categoryId}`,
  );
}
