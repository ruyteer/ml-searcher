"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProductThumb } from "@/components/produto/product-thumb";
import { formatBRL, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductDetailSheet, useProductActions } from "./product-detail-sheet";
import type { ProductListItem } from "@/lib/data/products";
import type { PresellOption } from "@/components/produto/generate-link-menu";

/// Linha da tabela de /produtos, usada só do breakpoint md pra cima (no
/// celular a mesma lista vira cartão, em product-card.tsx). Clicar abre o
/// Sheet de detalhe, carregado sob demanda. `presells` vem pronto do servidor
/// (table.tsx): nenhum componente cliente daqui chama função de leitura que
/// dependa de prisma.
export function ProductRow({ product, presells }: { product: ProductListItem; presells: PresellOption[] }) {
  const { open, setOpen, blocked, toggleBlocked, isPending } = useProductActions(product);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen(true)}>
        <TableCell>
          <ProductThumb src={product.thumbnail} alt={product.title} size={40} />
        </TableCell>
        <TableCell className="max-w-64 truncate" title={product.title}>
          <span>{product.title}</span>
          {blocked && (
            <Badge variant="destructive" className="ml-2">
              Bloqueado
            </Badge>
          )}
        </TableCell>
        <TableCell>{formatBRL(product.price)}</TableCell>
        <TableCell>{formatBRL(product.lowestPrice)}</TableCell>
        <TableCell>
          {product.variationPct === null ? (
            <span className="text-muted-foreground">-</span>
          ) : (
            <span
              className={cn(
                product.variationPct < 0
                  ? "text-success"
                  : product.variationPct > 0
                    ? "text-danger"
                    : "text-muted-foreground",
              )}
            >
              {product.variationPct > 0 ? "+" : ""}
              {product.variationPct}%
            </span>
          )}
        </TableCell>
        <TableCell className="max-w-32 truncate">{product.sellerName ?? "-"}</TableCell>
        <TableCell>{product.soldQuantity.toLocaleString("pt-BR")}</TableCell>
        <TableCell className="max-w-32 truncate">{product.watchLabel ?? product.categoryName ?? "-"}</TableCell>
        <TableCell>{formatDateTime(product.lastSeenAt)}</TableCell>
      </TableRow>

      <ProductDetailSheet
        product={product}
        presells={presells}
        open={open}
        onOpenChange={setOpen}
        blocked={blocked}
        onToggleBlocked={toggleBlocked}
        isPending={isPending}
      />
    </>
  );
}
