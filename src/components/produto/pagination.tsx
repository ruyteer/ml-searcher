"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/// Paginador simples compartilhado entre /ofertas (grid) e /produtos (tabela).
export function Pagination({ page, pageCount, total, onPageChange, className }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <div className={cn("flex items-center justify-between gap-3 text-sm text-muted-foreground", className)}>
      <span>
        Página {page} de {pageCount}, {total.toLocaleString("pt-BR")} no total
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <HugeiconsIcon icon={ChevronLeftIcon} size={15} strokeWidth={1.5} />
        </Button>
        <Button variant="outline" size="icon-sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          <HugeiconsIcon icon={ChevronRightIcon} size={15} strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
}
