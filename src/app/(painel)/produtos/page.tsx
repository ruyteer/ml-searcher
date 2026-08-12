import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { getWatchOptions } from "@/lib/data/products";
import { loadProductsParams, shouldListProducts, toProductFilters } from "./params";
import { getCategoriesOverview } from "./data";
import { ProductsFilters } from "./filters";
import { CategoryPicker } from "./category-picker";
import { ProductsTable } from "./table";
import { ProductsTableSkeleton } from "./table-skeleton";

interface ProdutosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/// /produtos não abre mais despejando o catálogo inteiro (são dezenas de
/// milhares de itens e ninguém rola isso). A página abre perguntando o que o
/// usuário quer ver: uma categoria monitorada, uma busca por nome, ou o
/// catálogo completo se ele insistir. Só depois disso a tabela é consultada,
/// então nem a query pesada roda à toa.
export default async function ProdutosPage({ searchParams }: ProdutosPageProps) {
  const params = await loadProductsParams(searchParams);
  const listing = shouldListProducts(params);
  const filters = toProductFilters(params);
  const watches = await getWatchOptions();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Produtos"
        description="Tudo que as varreduras já encontraram. Escolha uma categoria ou busque pelo nome."
      />

      <ProductsFilters watches={watches} listing={listing} />

      {listing ? (
        /* Sem key: o useTransition dos filtros mantém a tabela atual visível
           enquanto a página nova carrega; só a primeira carga usa o skeleton. */
        <Suspense fallback={<ProductsTableSkeleton />}>
          <ProductsTable filters={filters} watches={watches} />
        </Suspense>
      ) : (
        <Suspense fallback={<ProductsTableSkeleton />}>
          <ProductsEntry />
        </Suspense>
      )}
    </div>
  );
}

/// Server Component só pra manter o resumo por categoria fora do caminho
/// crítico do render inicial.
async function ProductsEntry() {
  const overview = await getCategoriesOverview();
  return (
    <CategoryPicker
      categories={overview.categories}
      totalProducts={overview.totalProducts}
      uncategorized={overview.uncategorized}
      recentDays={overview.recentDays}
    />
  );
}
