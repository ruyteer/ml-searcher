"use client";

import { useQueryStates } from "nuqs";
import { useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { productsParsers } from "./params";
import type { ProductSort } from "@/lib/data/products";

export interface SortHeaderProps {
  sortKey: ProductSort;
  children: React.ReactNode;
  className?: string;
}

/// Cabeçalho de coluna clicável — alterna asc/desc na mesma coluna, ou troca
/// pra ela (desc primeiro) quando clicada pela primeira vez.
export function SortHeader({ sortKey, children, className }: SortHeaderProps) {
  const [, startTransition] = useTransition();
  const [{ sort, sortDir }, setFilters] = useQueryStates(
    { sort: productsParsers.sort, sortDir: productsParsers.sortDir },
    { shallow: false, startTransition },
  );

  const active = sort === sortKey;

  return (
    <TableHead className={cn("cursor-pointer select-none", className)}>
      <button
        type="button"
        className="flex items-center gap-1 hover:text-foreground"
        onClick={() => setFilters({ sort: sortKey, sortDir: active && sortDir === "desc" ? "asc" : "desc" })}
      >
        {children}
        {active ? (
          sortDir === "desc" ? (
            <ArrowDown className="size-3.5" />
          ) : (
            <ArrowUp className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}
