import { IconProdutoVazio } from "@/components/icons";
import { EmptyState } from "@/components/shell/empty-state";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProducts, type ProductFilters, type WatchOption } from "@/lib/data/products";
import { getActivePresells } from "@/lib/data/offers";
import { SortHeader } from "./sort-header";
import { ProductRow } from "./product-row";
import { ProductsPagination } from "./products-pagination";

/// Rótulo do filtro de disponibilidade, em português. Os valores da URL e do
/// banco continuam sendo unblocked/blocked/all.
const DISPONIBILIDADE_NOUN: Record<string, string> = {
  unblocked: "produtos disponíveis",
  blocked: "produtos bloqueados",
  all: "produtos",
};

/// Frase honesta do que está na tela: quantos itens desta página, de quantos no
/// total, e qual recorte está ativo. O usuário perguntou se ia mesmo ver 40 mil
/// produtos; esta linha responde isso toda vez.
function summarize(filters: ProductFilters, shown: number, total: number, watchLabel: string | null): string {
  const noun = DISPONIBILIDADE_NOUN[filters.blocked] ?? "produtos";
  const head =
    total <= shown
      ? `Mostrando ${total.toLocaleString("pt-BR")} ${noun}`
      : `Mostrando ${shown} de ${total.toLocaleString("pt-BR")} ${noun}`;

  const parts = [head];
  if (watchLabel) parts.push(`na categoria ${watchLabel}`);
  else parts.push("de todas as categorias");
  if (filters.search.trim()) parts.push(`com "${filters.search.trim()}" no nome`);

  return `${parts.join(", ")}.`;
}

/// Tabela densa do catálogo. Server Component async dentro do <Suspense> de
/// page.tsx. Paginação real no banco via getProducts (skip/take).
export async function ProductsTable({
  filters,
  watches,
}: {
  filters: ProductFilters;
  watches: WatchOption[];
}) {
  const [result, presells] = await Promise.all([getProducts(filters), getActivePresells()]);
  const watchLabel = filters.watchId ? (watches.find((w) => w.id === filters.watchId)?.label ?? null) : null;

  if (result.items.length === 0) {
    return (
      <EmptyState
        icon={IconProdutoVazio}
        title="Nenhum produto encontrado"
        description={
          filters.search.trim()
            ? `Nada com "${filters.search.trim()}" no nome dentro deste recorte. Tente outro trecho do nome ou limpe os filtros.`
            : "Nenhum produto bate com os filtros escolhidos. Limpe os filtros ou escolha outra categoria."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {summarize(filters, result.items.length, result.total, watchLabel)}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14"></TableHead>
            <SortHeader sortKey="title">Nome</SortHeader>
            <SortHeader sortKey="price">Preço atual</SortHeader>
            <TableHead>Menor preço já visto</TableHead>
            <TableHead>Comparado com a média</TableHead>
            <TableHead>Vendedor</TableHead>
            <SortHeader sortKey="sold">Vendas</SortHeader>
            <TableHead>Categoria monitorada</TableHead>
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
