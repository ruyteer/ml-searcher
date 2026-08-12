"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Trash2,
  BadgePercent,
  ImageOff,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shell/empty-state";
import { LinkKind } from "@/generated/prisma";
import { formatCompact, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setLinkActiveAction, deleteLinkAction } from "./actions";
import { linksSearchParams } from "./search-params";
import type { LinkListRow } from "@/lib/data/links";

export interface LinkRow extends LinkListRow {
  publicHref: string;
}

const KIND_BADGE: Record<LinkKind, { label: string; variant: "default" | "secondary" | "outline" }> = {
  [LinkKind.DIRECT]: { label: "Direto", variant: "outline" },
  [LinkKind.TRACKED]: { label: "Rastreado", variant: "secondary" },
  [LinkKind.PRESELL]: { label: "Pre-sell", variant: "default" },
};

export function LinkTable({ rows }: { rows: LinkRow[] }) {
  const [sort, setSort] = useQueryState("sort", linksSearchParams.sort);
  const [, setLinkId] = useQueryState("linkId", linksSearchParams.linkId);

  const isDesc = sort === "clicks-desc";
  const isAsc = sort === "clicks-asc";

  function toggleClickSort() {
    setSort(isDesc ? "clicks-asc" : "clicks-desc");
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BadgePercent}
        title="Nenhum link encontrado"
        description="Ajuste os filtros ou crie um novo link para começar a rastrear cliques."
      />
    );
  }

  return (
    <TooltipProvider>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>URL pública</TableHead>
            <TableHead>Destino</TableHead>
            <TableHead>
              <button
                type="button"
                onClick={toggleClickSort}
                className="flex items-center gap-1 hover:text-primary"
              >
                Cliques
                {isDesc && <ArrowDown className="size-3" />}
                {isAsc && <ArrowUp className="size-3" />}
                {!isDesc && !isAsc && <ArrowUpDown className="size-3" />}
              </button>
            </TableHead>
            <TableHead>Únicos</TableHead>
            <TableHead>Último clique</TableHead>
            <TableHead>Ativo</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <LinkTableRow key={row.id} row={row} onOpen={() => setLinkId(row.id)} />
          ))}
        </TableBody>
      </Table>
    </TooltipProvider>
  );
}

function LinkTableRow({ row, onOpen }: { row: LinkRow; onOpen: () => void }) {
  const router = useRouter();
  const [active, setActive] = useState(row.active);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, startTransition] = useTransition();

  const badge = KIND_BADGE[row.kind];

  function stop(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  function handleToggleActive(next: boolean) {
    setActive(next); // otimista
    startTransition(async () => {
      try {
        await setLinkActiveAction(row.id, next);
        router.refresh();
      } catch {
        setActive(!next);
        toast.error("Não foi possível atualizar o link.");
      }
    });
  }

  function handleCopy(e: React.SyntheticEvent) {
    stop(e);
    navigator.clipboard
      .writeText(row.publicHref)
      .then(() => toast.success("URL copiada."))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  function handleOpenTarget(e: React.SyntheticEvent) {
    stop(e);
    window.open(row.targetUrl, "_blank", "noopener,noreferrer");
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteLinkAction(row.id);
        toast.success("Link excluído.");
        router.refresh();
      } catch {
        toast.error("Não foi possível excluir o link.");
      }
    });
    setDeleteOpen(false);
  }

  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell>
        {row.product ? (
          <div className="flex items-center gap-2">
            {row.product.thumbnail ? (
              <Image
                src={row.product.thumbnail}
                alt={row.product.title}
                width={32}
                height={32}
                className="size-8 shrink-0 rounded-md object-cover ring-1 ring-border"
              />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <ImageOff className="size-3.5" />
              </div>
            )}
            <span className="line-clamp-1 max-w-48 text-sm">{row.product.title}</span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            {row.label || "— (link avulso)"}
          </span>
        )}
      </TableCell>

      <TableCell>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-1.5">
          <span className="max-w-40 truncate font-mono text-xs text-muted-foreground">
            {row.publicHref}
          </span>
          <Button variant="ghost" size="icon-xs" onClick={handleCopy} title="Copiar URL pública">
            <Copy className="size-3" />
          </Button>
        </div>
      </TableCell>

      <TableCell>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={handleOpenTarget}
                className="flex max-w-52 items-center gap-1 truncate text-left text-xs text-muted-foreground hover:text-foreground"
              />
            }
          >
            {row.affiliate && <BadgePercent className="size-3 shrink-0 text-primary" />}
            <span className="truncate">{row.targetUrl}</span>
            <ExternalLink className="size-3 shrink-0" />
          </TooltipTrigger>
          <TooltipContent>{row.targetUrl}</TooltipContent>
        </Tooltip>
      </TableCell>

      <TableCell className="font-medium">{formatCompact(row.clickCount)}</TableCell>
      <TableCell className="text-muted-foreground">{formatCompact(row.uniqueClicks)}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {row.lastClickAt ? formatDateTime(row.lastClickAt) : "—"}
      </TableCell>

      <TableCell onClick={stop}>
        <Switch checked={active} onCheckedChange={handleToggleActive} />
      </TableCell>

      <TableCell onClick={stop}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" />}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleCopy}>
              <Copy /> Copiar URL pública
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenTarget}>
              <ExternalLink /> Abrir destino
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                stop(e);
                setDeleteOpen(true);
              }}
            >
              <Trash2 /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent onClick={stop}>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir este link?</AlertDialogTitle>
              <AlertDialogDescription>
                O histórico de cliques associado a ele será apagado junto e não pode ser desfeito.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/80")}
                onClick={handleDelete}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}
