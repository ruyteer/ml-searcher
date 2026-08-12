/// Árvore de categorias do Mercado Livre.
///
/// A árvore muda muito raramente, então cada nó fica em cache no módulo por
/// algumas horas — uma varredura completa não precisa bater na API de novo.

import { mlRequest, isMLApiError } from "./client";
import type { MLCategoryRef, MLCategoryResponse, MLRootCategory } from "./types";

/// Beleza e Cuidado Pessoal — raiz do nicho (verificado contra a API).
///
/// ATENÇÃO: a raiz sozinha NÃO define o nicho. Ela contém Maquiagem, Manicure
/// e Pedicure, Depilação e Farmácia (onde mora "Cuidado Sexual"), e aceitar
/// qualquer coisa abaixo dela era exatamente o que deixava passar produto
/// feminino e íntimo. Quem decide agora é a dupla lista de permitidas /
/// bloqueadas mais abaixo.
export const BEAUTY_ROOT = "MLB1246";

/// Subcategorias verificadas de MLB1246, usadas como referência ao montar
/// as watches iniciais:
///   MLB264787  Barbearia
///   MLB1263    Cuidados com o Cabelo
///   MLB199407  Cuidados com a Pele
///   MLB6284    Perfumes
///   MLB198312  Higiene Pessoal
export const BEAUTY_SUBCATEGORIES = {
  barbearia: "MLB264787",
  cabelo: "MLB1263",
  pele: "MLB199407",
  perfumes: "MLB6284",
  higiene: "MLB198312",
} as const;

export type BeautySubcategory = keyof typeof BEAUTY_SUBCATEGORIES;

// -------------------------------------------------- nicho: cuidado masculino

export interface NicheCategory {
  id: string;
  label: string;
  /// Pai dentro desta mesma lista. null = aparece na raiz da tela.
  parentId: string | null;
  depth: number;
}

/// Conjunto enxuto de categorias de cuidado pessoal masculino.
///
/// TODOS os ids foram conferidos um a um contra GET /categories/{id} na API
/// real do Mercado Livre, com as credenciais do projeto — nada aqui foi
/// deduzido nem inventado. Já erramos isso antes (MLB1276 é Esportes e
/// Fitness, MLB263532 é Ferramentas), então: id novo só entra depois de bater
/// na API e conferir o nome.
///
/// Esta mesma lista é a base do `prisma/seed.ts`. Se mexer aqui, mexa lá.
export const MALE_CARE_CATEGORIES: readonly NicheCategory[] = [
  // Barbearia e o que cresce dela — o coração do nicho.
  { id: "MLB264787", label: "Barbearia", parentId: null, depth: 0 },
  { id: "MLB277980", label: "Barbeadores", parentId: "MLB264787", depth: 1 },
  { id: "MLB264805", label: "Lâminas de barbear", parentId: "MLB264787", depth: 1 },
  { id: "MLB264791", label: "Espumas de barbear", parentId: "MLB264787", depth: 1 },
  { id: "MLB264789", label: "Produtos pós barba", parentId: "MLB264787", depth: 1 },
  { id: "MLB264790", label: "Bálsamos, óleos e tônicos para barba", parentId: "MLB264787", depth: 1 },
  { id: "MLB278197", label: "Kits para barba", parentId: "MLB264787", depth: 1 },

  // Máquinas e aparadores. O pai real no ML é "Artefatos para Cabelo"
  // (MLB455174), que também guarda prancha e modelador de cachos — por isso
  // entram as filhas certeiras, não o ramo inteiro.
  { id: "MLB5411", label: "Máquinas de cortar cabelo", parentId: null, depth: 0 },
  { id: "MLB446228", label: "Aparadores de pelo", parentId: null, depth: 0 },
  { id: "MLB456356", label: "Peças de barbeador elétrico", parentId: null, depth: 0 },

  // Cabelo.
  { id: "MLB1263", label: "Cuidados com o cabelo", parentId: null, depth: 0 },
  { id: "MLB1265", label: "Shampoos e condicionadores", parentId: "MLB1263", depth: 1 },
  { id: "MLB32130", label: "Tratamentos para o cabelo", parentId: "MLB1263", depth: 1 },
  { id: "MLB263523", label: "Pomadas, ceras e gel para o cabelo", parentId: "MLB1263", depth: 1 },
  { id: "MLB388017", label: "Cremes de pentear", parentId: "MLB1263", depth: 1 },

  // Pele.
  { id: "MLB199407", label: "Cuidados com a pele", parentId: null, depth: 0 },
  { id: "MLB264874", label: "Cuidado facial", parentId: "MLB199407", depth: 1 },
  { id: "MLB1257", label: "Limpeza facial", parentId: "MLB199407", depth: 1 },
  { id: "MLB1262", label: "Cuidado do corpo", parentId: "MLB199407", depth: 1 },
  { id: "MLB8133", label: "Proteção solar", parentId: "MLB199407", depth: 1 },

  // Perfume.
  { id: "MLB6284", label: "Perfumes", parentId: null, depth: 0 },

  // Higiene do dia a dia.
  { id: "MLB44379", label: "Desodorantes", parentId: null, depth: 0 },
  { id: "MLB5382", label: "Sabonetes", parentId: null, depth: 0 },
  { id: "MLB264756", label: "Higiene bucal", parentId: null, depth: 0 },
  { id: "MLB264765", label: "Barbeadores descartáveis", parentId: null, depth: 0 },
  { id: "MLB416700", label: "Cartuchos para barbeadores", parentId: null, depth: 0 },
] as const;

/// Só os ids, para o filtro de nicho consultar em O(1).
export const MALE_CARE_CATEGORY_IDS: ReadonlySet<string> = new Set(
  MALE_CARE_CATEGORIES.map((c) => c.id),
);

/// Ramos de Beleza e Cuidado Pessoal que claramente NÃO são cuidado masculino.
/// Ids conferidos contra GET /categories/{id}. Bloquear o ramo derruba junto
/// todas as filhas dele — é por aqui que maquiagem, manicure, depilação e
/// farmácia (onde mora "Cuidado Sexual", o tal do gel lubrificante) somem.
export const OFF_NICHE_CATEGORIES: readonly { id: string; label: string }[] = [
  { id: "MLB1248", label: "Maquiagem" },
  { id: "MLB29884", label: "Manicure e pedicure" },
  { id: "MLB5383", label: "Depilação" },
  { id: "MLB431646", label: "Farmácia" },
  { id: "MLB431650", label: "Cuidado sexual" },
  { id: "MLB278194", label: "Tratamentos de beleza" },
  { id: "MLB264751", label: "Artigos para cabeleireiros" },
  { id: "MLB5398", label: "Perucas e apliques" },
  { id: "MLB264755", label: "Higiene feminina" },
  { id: "MLB455041", label: "Proteção para incontinência" },
  { id: "MLB264761", label: "Absorventes para axilas" },
  { id: "MLB199649", label: "Autobronzeador" },
] as const;

export const OFF_NICHE_CATEGORY_IDS: ReadonlySet<string> = new Set(
  OFF_NICHE_CATEGORIES.map((c) => c.id),
);

/// Como uma categoria se posiciona no nicho de cuidado pessoal masculino.
///   "masculino" — está na lista de permitidas (ela mesma ou uma ancestral)
///   "fora"      — está num ramo bloqueado
///   "neutro"    — nem uma coisa nem outra (ex.: "Coloração", "Repelentes")
export type NicheStanding = "masculino" | "fora" | "neutro";

/// Classifica a partir de um caminho de ancestrais já conhecido (a própria
/// categoria primeiro ou por último, tanto faz). Bloqueio vence permissão:
/// uma filha de Maquiagem nunca é cuidado masculino.
export function classifyPath(path: readonly string[]): NicheStanding {
  for (const id of path) if (OFF_NICHE_CATEGORY_IDS.has(id)) return "fora";
  for (const id of path) if (MALE_CARE_CATEGORY_IDS.has(id)) return "masculino";
  return "neutro";
}

// ----------------------------------------------------- filtro por título

function foldAccents(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/// Palavras que, sozinhas, já denunciam produto feminino ou íntimo. Lista
/// curta de propósito: é a última camada e só entra o que não tem leitura
/// masculina possível.
const TITULO_FORA_NICHO =
  /\b(absorvente|absorventes|coletor menstrual|menstrual|tampao|calcinha|calcinhas|sutia|sutias|batom|batons|esmalte|esmaltes|maquiagem|delineador|rimel|mascara de cilios|cilios|unhas? postica|unhas? de gel|alongamento de unhas?|peruca|perucas|aplique de cabelo|megahair|mega hair|lubrificante intimo|gel lubrificante|preservativo|preservativos|camisinha|camisinhas|vibrador|plug anal|sex ?shop|masturbador|ducha higienica|epilador|depilador feminino|cera depilatoria|teste de gravidez|absorvente interno)\b/;

/// Salvo-conduto: título que se declara masculino (ou é claramente de barba)
/// nunca é barrado pela camada de palavra. Produto unissex de cabelo e pele é
/// legítimo no nicho, então na dúvida o item passa e o motivo vai para o log.
const TITULO_MASCULINO =
  /\b(barba|barbas|barbear|barbeador|barbeadores|masculin[oa]s?|men'?s|for men|homem|homens|aparador de pelos?|maquina de cortar|pos[- ]barba|after ?shave|minoxidil|pomada modeladora)\b/;

/// O título denuncia produto fora do nicho masculino?
export function tituloForaDoNicho(title: string): boolean {
  const t = foldAccents(title);
  if (TITULO_MASCULINO.test(t)) return false;
  return TITULO_FORA_NICHO.test(t);
}

// ------------------------------------------- filtro por tipo de produto

/// Tipos de produto (domain_id) que nunca são cuidado masculino. Casamos por
/// palavra dentro do id em vez de manter uma lista fechada de ids exatos:
/// o ML cria domínio novo o tempo todo e id inventado já nos custou caro.
const DOMINIO_FORA_NICHO =
  /(MAKEUP|LIPSTICK|LIP_GLOSS|NAIL|MANICURE|PEDICURE|EYELASH|EYEBROW|MASCARA|WIG|HAIR_EXTENSION|LUBRICANT|CONDOM|SEX_|INTIMATE|MENSTRUAL|SANITARY|TAMPON|PANTY|BRA_|DEPILAT|EPILAT|WAXING|PREGNANCY_TEST|MEDICINE|DRUG)/;

/// O tipo de produto denuncia algo fora do nicho masculino?
export function tipoDeProdutoForaDoNicho(domainId: string | null | undefined): boolean {
  if (!domainId) return false;
  return DOMINIO_FORA_NICHO.test(domainId.toUpperCase());
}

/// 6h: tempo de sobra para uma varredura inteira reaproveitar o mesmo nó.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/// Trava de segurança contra árvores patologicamente fundas.
const MAX_SUPPORTED_DEPTH = 6;

export interface CategoryNode {
  id: string;
  name: string;
  children: MLCategoryRef[];
  /// Caminho da raiz do site até esta categoria, inclusive ela própria.
  pathFromRoot: MLCategoryRef[];
}

export interface FlatCategory {
  id: string;
  name: string;
  /// null na raiz da varredura.
  parentId: string | null;
  /// 0 na raiz.
  depth: number;
}

export interface CategoryOptions {
  signal?: AbortSignal;
  /// Ignora o cache e refaz a chamada.
  force?: boolean;
}

// ------------------------------------------------------------------- cache

interface CacheEntry {
  value: CategoryNode;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
/// Chamadas em voo: duas watches irmãs pedindo o mesmo pai aguardam a mesma Promise.
const inflight = new Map<string, Promise<CategoryNode>>();

export function clearCategoryCache(): void {
  cache.clear();
  inflight.clear();
}

// ------------------------------------------------------------------- fetch

function toNode(raw: MLCategoryResponse): CategoryNode {
  return {
    id: raw.id,
    name: raw.name,
    children: (raw.children_categories ?? []).filter((c) => Boolean(c?.id)),
    pathFromRoot: (raw.path_from_root ?? []).filter((c) => Boolean(c?.id)),
  };
}

export async function fetchCategory(
  id: string,
  options: CategoryOptions = {},
): Promise<CategoryNode> {
  const now = Date.now();

  if (!options.force) {
    const hit = cache.get(id);
    if (hit && hit.expiresAt > now) return hit.value;
    const pending = inflight.get(id);
    if (pending) return pending;
  }

  const promise = mlRequest<MLCategoryResponse>(`/categories/${encodeURIComponent(id)}`, {
    signal: options.signal,
  })
    .then((raw) => {
      const node = toNode(raw);
      cache.set(id, { value: node, expiresAt: Date.now() + CACHE_TTL_MS });
      return node;
    })
    .finally(() => {
      if (inflight.get(id) === promise) inflight.delete(id);
    });

  inflight.set(id, promise);
  return promise;
}

/// Lista as categorias raiz do site (/sites/{site}/categories).
export async function fetchRootCategories(
  siteId = "MLB",
  options: CategoryOptions = {},
): Promise<MLRootCategory[]> {
  return mlRequest<MLRootCategory[]>(`/sites/${encodeURIComponent(siteId)}/categories`, {
    signal: options.signal,
  });
}

// -------------------------------------------------------------------- walk

/// Achata a árvore a partir de `rootId` até `maxDepth` níveis abaixo dela.
/// As chamadas de cada nível saem em paralelo — o semáforo do client é quem
/// limita a concorrência real contra a API. Um nó que falhar vira folha em
/// vez de derrubar a varredura inteira.
export async function walkCategoryTree(
  rootId: string,
  maxDepth = 1,
  options: CategoryOptions = {},
): Promise<FlatCategory[]> {
  const depthLimit = Math.min(Math.max(0, Math.floor(maxDepth)), MAX_SUPPORTED_DEPTH);

  const out: FlatCategory[] = [];
  const seen = new Set<string>();
  /// Nós cujos filhos ainda precisam ser buscados no próximo nível.
  let frontier: Array<{ id: string; parentId: string | null }> = [
    { id: rootId, parentId: null },
  ];

  for (let depth = 0; depth <= depthLimit && frontier.length > 0; depth += 1) {
    const pending = frontier.filter((node) => !seen.has(node.id));
    for (const node of pending) seen.add(node.id);
    if (pending.length === 0) break;

    const fetched = await Promise.all(
      pending.map(async (node) => {
        try {
          return { node, data: await fetchCategory(node.id, options) };
        } catch {
          // Categoria inacessível: registramos sem nome e sem filhos.
          return { node, data: null };
        }
      }),
    );

    const next = new Map<string, { id: string; parentId: string | null }>();
    for (const { node, data } of fetched) {
      out.push({
        id: node.id,
        name: data?.name ?? node.id,
        parentId: node.parentId,
        depth,
      });
      if (!data || depth === depthLimit) continue;
      for (const child of data.children) {
        // dedupe também dentro do mesmo nível: uma categoria pode aparecer
        // como filha de mais de um pai.
        if (seen.has(child.id) || next.has(child.id)) continue;
        next.set(child.id, { id: child.id, parentId: node.id });
      }
    }

    frontier = [...next.values()];
  }

  return out;
}

// ------------------------------------------------------------- pertencimento

/// A categoria está dentro da subárvore de `rootId`?
///
/// Usamos `path_from_root` de /categories/{id} em vez de achatar a árvore
/// inteira com `walkCategoryTree`: a subárvore de Beleza tem 342 categorias em
/// 5 níveis, então montar o conjunto custaria 342 chamadas, enquanto uma
/// varredura toca algumas dezenas de categorias distintas. As duas formas usam
/// o mesmo cache de 6h deste módulo, e o caminho vale em qualquer profundidade.
///
/// Devolve `null` quando a categoria não pôde ser resolvida (rede, 404) —
/// quem chama decide o que fazer com a dúvida, para não descartar produto bom
/// por causa de uma falha passageira.
export async function isUnderCategory(
  categoryId: string,
  rootId: string = BEAUTY_ROOT,
  options: CategoryOptions = {},
): Promise<boolean | null> {
  if (!categoryId) return null;
  if (categoryId === rootId) return true;

  let node: CategoryNode;
  try {
    node = await fetchCategory(categoryId, options);
  } catch (err) {
    if (isMLApiError(err) && err.code === "ABORTED") throw err;
    return null;
  }
  if (node.pathFromRoot.length === 0) return null;
  return node.pathFromRoot.some((step) => step.id === rootId);
}

/// Onde a categoria de um anúncio cai no nicho de cuidado masculino.
/// `null` = não deu para resolver (rede, 404). Quem chama trata a dúvida —
/// a regra do projeto é deixar passar e registrar, nunca descartar calado.
export async function classifyCategory(
  categoryId: string,
  options: CategoryOptions = {},
): Promise<NicheStanding | null> {
  if (!categoryId) return null;
  // Atalhos sem chamada: a própria categoria já está numa das listas.
  if (OFF_NICHE_CATEGORY_IDS.has(categoryId)) return "fora";

  let node: CategoryNode;
  try {
    node = await fetchCategory(categoryId, options);
  } catch (err) {
    if (isMLApiError(err) && err.code === "ABORTED") throw err;
    return null;
  }
  if (node.pathFromRoot.length === 0) return null;

  const path = node.pathFromRoot.map((step) => step.id);
  // Fora de Beleza e Cuidado Pessoal por completo (ex.: shampoo automotivo).
  if (!path.includes(BEAUTY_ROOT)) return "fora";
  return classifyPath([categoryId, ...path]);
}
