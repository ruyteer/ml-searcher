import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "../prisma";
import { TAGS } from "../cache";
import { classifyPath, walkCategoryTree } from "@/lib/ml/categories";
import type { NicheStanding } from "@/lib/ml/categories";
import type { Watch } from "@/generated/prisma";

/// Camada de dados das watches (categorias monitoradas). Só persistência —
/// quem chama (as Server Actions em configuracoes/actions.ts) é responsável
/// por validar com zod e por chamar bust(TAGS.watches) no fim.

export interface WatchInput {
  label: string;
  categoryId: string | null;
  query: string | null;
  /// Domínio de catálogo do ML (ex. MLB-RAZOR_BLADES). null = sem filtro de domínio.
  domainId: string | null;
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
      domainId: input.domainId,
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
      domainId: input.domainId,
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

/// Alterna várias de uma vez, numa transação só.
export async function setWatchesEnabled(ids: string[], enabled: boolean): Promise<number> {
  if (ids.length === 0) return 0;
  const { count } = await prisma.watch.updateMany({ where: { id: { in: ids } }, data: { enabled } });
  return count;
}

// -------------------------------------------------- categorias descartadas

/// Onde guardamos os ids de categoria do Mercado Livre que o usuário excluiu.
/// Fica no Setting (chave/valor livre) porque é memória de decisão do usuário,
/// não ajuste de comportamento — e assim não precisa de coluna nova no banco.
const DISCARDED_KEY = "categoriasDescartadas";

/// Ids de categoria que o usuário já excluiu de propósito. A sincronização
/// automática consulta esta lista e não recria nenhum deles.
export async function listDiscardedCategoryIds(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: DISCARDED_KEY } });
  if (!row?.value) return [];
  try {
    const parsed: unknown = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

async function saveDiscardedCategoryIds(ids: string[]): Promise<void> {
  const value = JSON.stringify([...new Set(ids)]);
  await prisma.setting.upsert({
    where: { key: DISCARDED_KEY },
    create: { key: DISCARDED_KEY, value },
    update: { value },
  });
}

/// Esquece as exclusões: a próxima sincronização volta a trazer tudo.
export async function clearDiscardedCategories(): Promise<number> {
  const atuais = await listDiscardedCategoryIds();
  if (atuais.length > 0) await saveDiscardedCategoryIds([]);
  return atuais.length;
}

// ------------------------------------------------------------- exclusão

export interface DeleteWatchesResult {
  /// Quantas categorias monitoradas saíram da lista.
  excluidas: number;
  /// Quantos produtos já coletados ficaram sem categoria (continuam no catálogo).
  produtosSoltos: number;
  /// Quantos ids de categoria entraram na lista de descartadas.
  descartadas: number;
}

/// Exclui várias categorias monitoradas numa transação só.
///
/// Produtos já coletados NÃO somem: o schema usa onDelete: SetNull, então eles
/// apenas ficam sem categoria e seguem no catálogo, com histórico e ofertas
/// intactos. As categorias que vieram da sincronização automática entram na
/// lista de descartadas para que a próxima sincronização não as ressuscite.
export async function deleteWatches(ids: string[]): Promise<DeleteWatchesResult> {
  if (ids.length === 0) return { excluidas: 0, produtosSoltos: 0, descartadas: 0 };

  const alvos = await prisma.watch.findMany({
    where: { id: { in: ids } },
    select: { id: true, categoryId: true },
  });
  if (alvos.length === 0) return { excluidas: 0, produtosSoltos: 0, descartadas: 0 };

  const alvoIds = alvos.map((w) => w.id);
  const categoriasAlvo = alvos.map((w) => w.categoryId).filter((v): v is string => Boolean(v));

  const produtosSoltos = await prisma.product.count({ where: { watchId: { in: alvoIds } } });

  const jaDescartadas = await listDiscardedCategoryIds();
  const novasDescartadas = [...new Set([...jaDescartadas, ...categoriasAlvo])];

  const [{ count }] = await prisma.$transaction([
    prisma.watch.deleteMany({ where: { id: { in: alvoIds } } }),
    prisma.setting.upsert({
      where: { key: DISCARDED_KEY },
      create: { key: DISCARDED_KEY, value: JSON.stringify(novasDescartadas) },
      update: { value: JSON.stringify(novasDescartadas) },
    }),
  ]);

  return {
    excluidas: count,
    produtosSoltos,
    descartadas: novasDescartadas.length - jaDescartadas.length,
  };
}

/// Exclui uma só. Produtos já coletados ficam com watchId nulo (onDelete:
/// SetNull no schema) — eles permanecem no catálogo normalmente.
export async function deleteWatch(id: string): Promise<DeleteWatchesResult> {
  return deleteWatches([id]);
}

// ------------------------------------------------------------- estatísticas

export interface WatchStats {
  id: string;
  /// Produtos já coletados por esta categoria.
  produtos: number;
  /// Ofertas que esses produtos já renderam.
  ofertas: number;
  /// Onde ela cai no nicho de cuidado pessoal masculino.
  standing: NicheStanding;
}

interface CountRow {
  watchId: string;
  produtos: number;
  ofertas: number;
}

/// Produtos e ofertas por categoria monitorada, mais a leitura de nicho.
/// É o que a tela precisa para o usuário decidir o que apagar sem chutar.
export async function listWatchStats(): Promise<WatchStats[]> {
  const [watches, rows] = await Promise.all([
    prisma.watch.findMany({ select: { id: true, categoryId: true, parentCategoryId: true } }),
    // Uma consulta só: agregar em memória custaria carregar o catálogo inteiro.
    prisma.$queryRaw<CountRow[]>`
      SELECT p."watchId" AS "watchId",
             COUNT(DISTINCT p.id)::int AS "produtos",
             COUNT(o.id)::int AS "ofertas"
      FROM "Product" p
      LEFT JOIN "Offer" o ON o."productId" = p.id
      WHERE p."watchId" IS NOT NULL
      GROUP BY p."watchId"
    `,
  ]);

  const contagem = new Map(rows.map((r) => [r.watchId, r]));
  // Pai de cada categoria, para subir a árvore sem bater na API.
  const paiDe = new Map<string, string | null>();
  for (const w of watches) {
    if (w.categoryId) paiDe.set(w.categoryId, w.parentCategoryId);
  }

  function caminho(categoryId: string | null): string[] {
    const out: string[] = [];
    let atual = categoryId;
    // O limite corta qualquer ciclo que um dado torto possa ter criado.
    for (let i = 0; atual && i < 12; i += 1) {
      out.push(atual);
      atual = paiDe.get(atual) ?? null;
    }
    return out;
  }

  return watches.map((w) => {
    const row = contagem.get(w.id);
    return {
      id: w.id,
      produtos: row?.produtos ?? 0,
      ofertas: row?.ofertas ?? 0,
      standing: w.categoryId ? classifyPath(caminho(w.categoryId)) : "neutro",
    };
  });
}

// -------------------------------------------------- sincronização automática

export interface SyncCategoryTreeResult {
  criadas: number;
  atualizadas: number;
  /// Categorias que existiam como watch automática mas não vieram mais na
  /// árvore atual do ML — não apagamos (podem ter produtos ligados), só contamos.
  removidas: number;
  /// Categorias que vieram na árvore do ML mas o usuário já tinha excluído:
  /// puladas de propósito, para a sincronização não desfazer a faxina dele.
  respeitadas: number;
  total: number;
}

/// Varre a árvore de categorias do ML a partir de `rootId` e faz upsert de
/// uma Watch por categoria (auto: true). Preserva enabled/minDiscount/limit/
/// domainId de watches já existentes — só atualiza label/parentCategoryId/depth.
/// domainId em especial é escolha do usuário via "Descobrir domínio" na UI,
/// então a sincronização automática nunca grava nem apaga esse campo.
/// Watches criadas na mão (auto: false) nunca são tocadas por aqui.
/// Categoria que o usuário excluiu NUNCA volta por aqui: antes de criar
/// qualquer coisa, a sincronização consulta a lista de descartadas e pula.
/// É isso que impede a árvore de ressuscitar as 300 categorias que ele acabou
/// de limpar. Para trazer tudo de volta, existe `clearDiscardedCategories()`.
export async function syncCategoryTree({
  rootId,
  maxDepth,
}: {
  rootId: string;
  maxDepth: number;
}): Promise<SyncCategoryTreeResult> {
  const [nodes, descartadas] = await Promise.all([
    walkCategoryTree(rootId, maxDepth),
    listDiscardedCategoryIds(),
  ]);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const descartadasSet = new Set(descartadas);

  const existentes = await prisma.watch.findMany({
    where: { categoryId: { not: null } },
    select: { categoryId: true, auto: true },
  });
  const porCategoria = new Map(
    existentes.map((w) => [w.categoryId as string, w.auto] as const),
  );

  // Categorias que já eram criadas automaticamente antes desta sincronização,
  // mas que sumiram da árvore atual do ML — relatadas, nunca apagadas.
  const removidas = existentes.filter(
    (w) => w.auto && w.categoryId && !nodeIds.has(w.categoryId),
  ).length;

  const paraCriar: typeof nodes = [];
  const paraAtualizar: typeof nodes = [];
  let respeitadas = 0;

  for (const node of nodes) {
    const auto = porCategoria.get(node.id);
    if (auto === undefined) {
      // Não existe. Só cria se o usuário não tiver excluído antes.
      if (descartadasSet.has(node.id)) respeitadas += 1;
      else paraCriar.push(node);
      continue;
    }
    // Criada na mão (auto === false): a sincronização não encosta.
    if (auto) paraAtualizar.push(node);
  }

  // Em lote: com centenas de categorias, um await por nó travava a tela.
  if (paraCriar.length > 0) {
    await prisma.watch.createMany({
      data: paraCriar.map((node) => ({
        label: node.name,
        categoryId: node.id,
        query: null,
        parentCategoryId: node.parentId,
        depth: node.depth,
        auto: true,
        enabled: true,
        limit: 100,
        minDiscount: null,
      })),
      skipDuplicates: true,
    });
  }

  if (paraAtualizar.length > 0) {
    await prisma.$transaction(
      paraAtualizar.map((node) =>
        prisma.watch.update({
          where: { categoryId: node.id },
          data: { label: node.name, parentCategoryId: node.parentId, depth: node.depth },
        }),
      ),
    );
  }

  return {
    criadas: paraCriar.length,
    atualizadas: paraAtualizar.length,
    removidas,
    respeitadas,
    total: nodes.length,
  };
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
