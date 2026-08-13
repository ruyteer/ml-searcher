import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const COLUMNS = [
  "",
  "Nome",
  "Preço atual",
  "Menor preço já visto",
  "Comparado com a média",
  "Vendedor",
  "Vendas",
  "Categoria monitorada",
  "Visto por último",
];

/// Espelha o layout real da lista pra não piscar a página inteira ao trocar
/// filtro/página (Suspense fallback). Como a lista tem duas formas (cartões no
/// celular, tabela no desktop), o esqueleto também tem.
export function ProductsTableSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="flex flex-row items-stretch gap-2.5 overflow-hidden p-0">
            <Skeleton className="h-24 w-24 shrink-0 rounded-none" />
            <div className="flex flex-1 flex-col gap-2 py-3">
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </Card>
        ))}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead key={col}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="size-10 rounded-lg" />
                </TableCell>
                {COLUMNS.slice(1).map((col) => (
                  <TableCell key={col}>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
