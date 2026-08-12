/// Árvore de categorias do Mercado Livre.
///
/// A árvore muda muito raramente, então cada nó fica em cache no módulo por
/// algumas horas — uma varredura completa não precisa bater na API de novo.

import { mlRequest } from "./client";
import type { MLCategoryRef, MLCategoryResponse, MLRootCategory } from "./types";

/// Beleza e Cuidado Pessoal — raiz do nicho (verificado contra a API).
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

/// 6h: tempo de sobra para uma varredura inteira reaproveitar o mesmo nó.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/// Trava de segurança contra árvores patologicamente fundas.
const MAX_SUPPORTED_DEPTH = 6;

export interface CategoryNode {
  id: string;
  name: string;
  children: MLCategoryRef[];
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
