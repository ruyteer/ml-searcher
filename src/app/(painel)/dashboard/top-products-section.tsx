import Image from "next/image";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconProdutos } from "@/components/icons";
import { Section } from "@/components/shell/section";
import { EmptyState } from "@/components/shell/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompact } from "@/lib/format";
import { getTopProducts, type Period } from "@/lib/data/metrics";

export async function TopProductsSection({ period }: { period: Period }) {
  const products = await getTopProducts(period);

  return (
    <Section title="Produtos mais clicados" description="Top 10 no período selecionado." className="h-full">
      {products.length === 0 ? (
        <EmptyState
          icon={IconProdutos}
          title="Nenhum clique em produto neste período"
          className="border-none py-10"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Cliques</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <Link href="/produtos" className="flex items-center gap-3">
                    {product.thumbnail ? (
                      <Image
                        src={product.thumbnail}
                        alt=""
                        width={40}
                        height={40}
                        className="size-10 shrink-0 rounded-md bg-muted object-cover"
                      />
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                        <HugeiconsIcon icon={IconProdutos} size={16} strokeWidth={1.6} className="text-muted-foreground" aria-hidden="true" />
                      </span>
                    )}
                    <span className="line-clamp-2 max-w-xs text-sm text-foreground">{product.title}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCompact(product.clicks)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}
