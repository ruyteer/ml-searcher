import { PackageX } from "lucide-react";
import { EmptyState } from "@/components/shell/empty-state";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProducts, type ProductFilters } from "@/lib/data/products";
import { getActivePresells } from "@/lib/data/offers";
import { SortHeader } from "./sort-header";
import { ProductRow } from "./product-row";
import { ProductsPagination } from "./products-pagination";

/// Tabela densa do catálogo — Server Component async dentro do <Suspense>
/// de page.tsx. Paginação real no banco via getProducts (skip/take).
export async function ProductsTable({ filters }: { filters: ProductFilters }) {
  const [result, presells] = await Promise.all([getProducts(filters), getActivePresells()]);

  if (result.items.length === 0) {
    return (
      <EmptyState
        icon={PackageX}
        title="Nenhum produto encontrado"
        description="Ajuste os filtros ou aguarde a próxima varredura."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14"></TableHead>
            <SortHeader sortKey="title">Produto</SortHeader>
            <SortHeader sortKey="price">Preço atual</SortHeader>
            <TableHead>Menor histórico</TableHead>
            <TableHead>Variação vs. média</TableHead>
            <TableHead>Vendedor</TableHead>
            <SortHeader sortKey="sold">Vendas</SortHeader>
            <TableHead>Watch</TableHead>
            <SortHeader sortKey="lastSeen">Visto por último</SortHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.items.map((product) => (
            <ProductRow key={product.id} product={product} presells={presells} />
          ))}
        </TableBody>
      </Table>
      <ProductsPagination pageCount={result.pageCount} total={result.total} />
    </div>
  );
}
