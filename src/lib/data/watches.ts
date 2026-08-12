import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "../prisma";
import { TAGS } from "../cache";
import { walkCategoryTree } from "@/lib/ml/categories";
import type { Watch } from "@/generated/prisma";

/// Camada de dados das watches (categorias monitoradas). Só persistência —
/// quem chama (as Server Actions em configuracoes/actions.ts) é responsável
/// por validar com zod e por chamar bust(TAGS.watches) no fim.

export interface WatchInput {
  label: string;
  categoryId: string | null;
  query: string | null;
  limit: number;
  /// null = herda o desconto mínimo global.
  minDiscount: number | null;
  enabled: boolean;
}

const cachedList = unstable_cache(
  async () => prisma.watch.findMany({ orderBy: { createdAt: "desc" } }),
  ["watches-list"],
  { tags: [TAGS.watches] },
);

/// Todas as watches, mais recentes primeiro.
export async function listWatches(): Promise<Watch[]> {
  return cachedList();
}

export async function getWatch(id: string): Promise<Watch | null> {
  return prisma.watch.findUnique({ where: { id } });
}

export async function createWatch(input: WatchInput): Promise<Watch> {
  return prisma.watch.create({
    data: {
      label: input.label,
      categoryId: input.categoryId,
      query: input.query,
      limit: input.limit,
      minDiscount: input.minDiscount,
      enabled: input.enabled,
    },
  });
}

export async function updateWatch(id: string, input: WatchInput): Promise<Watch> {
  return prisma.watch.update({
    where: { id },
    data: {
      label: input.label,
      categoryId: input.categoryId,
      query: input.query,
      limit: input.limit,
      minDiscount: input.minDiscount,
      enabled: input.enabled,
    },
  });
}

/// Alterna só o enabled — usado pelo Switch com salvamento otimista na tabela.
export async function setWatchEnabled(id: string, enabled: boolean): Promise<Watch> {
  return prisma.watch.update({ where: { id }, data: { enabled } });
}

/// Exclui a watch. Produtos já coletados ficam com watchId nulo (onDelete:
/// SetNull no schema) — eles permanecem no catálogo normalmente.
export async function deleteWatch(id: string): Promise<void> {
  await prisma.watch.delete({ where: { id } });
}

// -------------------------------------------------- sincronização automática

export interface SyncCategoryTreeResult {
  criadas: number;
  atualizadas: number;
  /// Categorias que existiam como watch automática mas não vieram mais na
  /// árvore atual do ML — não apagamos (podem ter produtos ligados), só contamos.
  removidas: number;
  total: number;
}

/// Varre a árvore de categorias do ML a partir de `rootId` e faz upsert de
/// uma Watch por categoria (auto: true). Preserva enabled/minDiscount/limit
/// de watches já existentes — só atualiza label/parentCategoryId/depth.
/// Watches criadas na mão (auto: false) nunca são tocadas por aqui.
export async function syncCategoryTree({
  rootId,
  maxDepth,
}: {
  rootId: string;
  maxDepth: number;
}): Promise<SyncCategoryTreeResult> {
  const nodes = await walkCategoryTree(rootId, maxDepth);
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Categorias que já eram watch automática antes desta sincronização, mas
  // que sumiram da árvore atual do ML — relatadas, nunca apagadas.
  const existingAuto = await prisma.watch.findMany({
    where: { auto: true, categoryId: { not: null } },
    select: { categoryId: true },
  });
  const removidas = existingAuto.filter((w) => w.categoryId && !nodeIds.has(w.categoryId)).length;

  let criadas = 0;
  let atualizadas = 0;

  for (const node of nodes) {
    const existing = await prisma.watch.findUnique({ where: { categoryId: node.id } });

    if (!existing) {
      await prisma.watch.create({
        data: {
          label: node.name,
          categoryId: node.id,
          query: null,
          parentCategoryId: node.parentId,
          depth: node.depth,
          auto: true,
          enabled: true,
          limit: 100,
          minDiscount: null,
        },
      });
      criadas++;
    } else if (existing.auto) {
      await prisma.watch.update({
        where: { categoryId: node.id },
        data: { label: node.name, parentCategoryId: node.parentId, depth: node.depth },
      });
      atualizadas++;
    }
    // existing.auto === false -> watch criada na mão, sincronização não mexe.
  }

  return { criadas, atualizadas, removidas, total: nodes.length };
}

/// Watches em ordem de árvore (pai antes das filhas, alfabético por nível),
/// pronta para a UI indentar por `depth`. Watches sem categoria (legado, só
/// termo de busca) e ramos órfãos (pai que sumiu da lista) aparecem na raiz.
export async function listWatchTree(): Promise<Watch[]> {
  const watches = await listWatches();
  const categoryIds = new Set(watches.filter((w) => w.categoryId).map((w) => w.categoryId as string));

  const byParent = new Map<string | null, Watch[]>();
  for (const watch of watches) {
    const parentKey =
      watch.parentCategoryId && categoryIds.has(watch.parentCategoryId) ? watch.parentCategoryId : null;
    const bucket = byParent.get(parentKey);
    if (bucket) bucket.push(watch);
    else byParent.set(parentKey, [watch]);
  }

  const out: Watch[] = [];
  function visit(parentKey: string | null) {
    const children = [...(byParent.get(parentKey) ?? [])].sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    );
    for (const child of children) {
      out.push(child);
      if (child.categoryId) visit(child.categoryId);
    }
  }
  visit(null);
  return out;
}
