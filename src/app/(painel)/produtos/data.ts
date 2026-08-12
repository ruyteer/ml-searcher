import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { TAGS } from "@/lib/cache";

/// Leituras exclusivas da tela de produtos: o resumo por categoria que alimenta
/// a tela de entrada. Ficam aqui, e não em src/lib/data/products.ts, porque só
/// esta rota consome. Nada disto é importado por componente cliente.

export interface CategorySummary {
  id: string;
  label: string;
  /// Produtos disponíveis (não bloqueados) nesta categoria.
  productCount: number;
  /// Ofertas detectadas nesta categoria nos últimos RECENT_DAYS dias.
  recentOfferCount: number;
}

export interface CategoriesOverview {
  categories: CategorySummary[];
  /// Total de produtos disponíveis no painel inteiro.
  totalProducts: number;
  /// Produtos que ainda não pertencem a nenhuma categoria monitorada.
  uncategorized: number;
  recentDays: number;
}

const RECENT_DAYS = 30;

interface OfferCountRow {
  watchId: string;
  count: number;
}

/// Resumo por categoria monitorada, tudo agregado no banco:
/// - contagem de produtos por categoria: groupBy do Prisma;
/// - contagem de ofertas recentes por categoria: precisa juntar Offer com
///   Product pra chegar no watchId, e o groupBy do Prisma não atravessa
///   relação, então vai em SQL. É um GROUP BY, não uma varredura em JS.
export const getCategoriesOverview = unstable_cache(
  async (): Promise<CategoriesOverview> => {
    const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);

    const [watches, productCounts, offerCounts, totalProducts, uncategorized] = await Promise.all([
      prisma.watch.findMany({ orderBy: { label: "asc" }, select: { id: true, label: true } }),
      prisma.product.groupBy({
        by: ["watchId"],
        where: { blocked: false },
        _count: { _all: true },
      }),
      prisma.$queryRaw<OfferCountRow[]>`
        SELECT p."watchId" AS "watchId", COUNT(*)::int AS "count"
        FROM "Offer" o
        JOIN "Product" p ON p."id" = o."productId"
        WHERE o."detectedAt" >= ${since} AND p."watchId" IS NOT NULL
        GROUP BY p."watchId"
      `,
      prisma.product.count({ where: { blocked: false } }),
      prisma.product.count({ where: { blocked: false, watchId: null } }),
    ]);

    const productByWatch = new Map<string, number>();
    for (const row of productCounts) {
      if (row.watchId) productByWatch.set(row.watchId, row._count._all);
    }

    const offerByWatch = new Map<string, number>();
    for (const row of offerCounts) {
      offerByWatch.set(row.watchId, Number(row.count));
    }

    const categories: CategorySummary[] = watches
      .map((w) => ({
        id: w.id,
        label: w.label,
        productCount: productByWatch.get(w.id) ?? 0,
        recentOfferCount: offerByWatch.get(w.id) ?? 0,
      }))
      .filter((c) => c.productCount > 0)
      // Quem teve mais oferta recente aparece primeiro: é onde o usuário tem
      // mais chance de achar algo pra divulgar hoje.
      .sort(
        (a, b) =>
          b.recentOfferCount - a.recentOfferCount ||
          b.productCount - a.productCount ||
          a.label.localeCompare(b.label, "pt-BR"),
      );

    return { categories, totalProducts, uncategorized, recentDays: RECENT_DAYS };
  },
  ["produtos-categorias-overview"],
  { tags: [TAGS.products, TAGS.watches, TAGS.offers] },
);
