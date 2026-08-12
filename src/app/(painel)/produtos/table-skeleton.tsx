import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const COLUMNS = [
  "",
  "Produto",
  "Preço atual",
  "Menor histórico",
  "Variação vs. média",
  "Vendedor",
  "Vendas",
  "Watch",
  "Visto por último",
];

/// Espelha o layout real da tabela pra não piscar a página inteira ao trocar
/// filtro/página (Suspense fallback).
export function ProductsTableSkeleton() {
  return (
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
  );
}
