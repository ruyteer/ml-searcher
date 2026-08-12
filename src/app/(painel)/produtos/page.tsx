import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { getWatchOptions } from "@/lib/data/products";
import { loadProductsParams, toProductFilters } from "./params";
import { ProductsFilters } from "./filters";
import { ProductsTable } from "./table";
import { ProductsTableSkeleton } from "./table-skeleton";

interface ProdutosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProdutosPage({ searchParams }: ProdutosPageProps) {
  const params = await loadProductsParams(searchParams);
  const filters = toProductFilters(params);
  const watches = await getWatchOptions();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Produtos" description="Catálogo completo monitorado pelas varreduras." />

      <ProductsFilters watches={watches} />

      {/* Sem key: o useTransition dos filtros mantém a tabela atual visível
          enquanto a página nova carrega — só a primeira carga usa o skeleton. */}
      <Suspense fallback={<ProductsTableSkeleton />}>
        <ProductsTable filters={filters} />
      </Suspense>
    </div>
  );
}
