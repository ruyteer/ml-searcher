"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Copy,
  ExternalLink,
  Eye,
  ImageOff,
  MousePointerClick,
  MoreHorizontal,
  Pencil,
  Trash2,
  CopyPlus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
import { formatCompact, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  setPresellActiveAction,
  deletePresellAction,
  duplicatePresellAction,
} from "./actions";
import type { PresellListRow } from "@/lib/data/presells";

export function PresellCard({ presell, publicHref }: { presell: PresellListRow; publicHref: string }) {
  const router = useRouter();
  const [active, setActive] = useState(presell.active);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleToggleActive(next: boolean) {
    setActive(next);
    startTransition(async () => {
      try {
        await setPresellActiveAction(presell.id, next);
        router.refresh();
      } catch {
        setActive(!next);
        toast.error("Não foi possível atualizar a pre-sell.");
      }
    });
  }

  function handleCopy() {
    navigator.clipboard
      .writeText(publicHref)
      .then(() => toast.success("URL copiada."))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicatePresellAction(presell.id);
      if (result.success) {
        toast.success("Pre-sell duplicada.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Não foi possível duplicar.");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deletePresellAction(presell.id);
        toast.success("Pre-sell excluída.");
        router.refresh();
      } catch {
        toast.error("Não foi possível excluir.");
      }
    });
    setDeleteOpen(false);
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video w-full bg-muted">
        {presell.imageUrl ? (
          // URL de imagem é livre (o usuário cola qualquer host) — same
          // decisão de /p/[slug]/page.tsx, que também evita next/image aqui.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={presell.imageUrl}
            alt={presell.title}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff className="size-6" />
          </div>
        )}
        <Badge
          variant={active ? "default" : "outline"}
          className="absolute top-2 left-2 bg-background/80 backdrop-blur"
        >
          {active ? "Ativa" : "Inativa"}
        </Badge>
      </div>

      <div className="flex flex-col gap-2 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <Link href={`/presells/${presell.id}`} className="line-clamp-1 font-medium hover:underline">
              {presell.title}
            </Link>
            <span className="font-mono text-xs text-muted-foreground">/p/{presell.slug}</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/presells/${presell.id}`} />}>
                <Pencil /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <CopyPlus /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopy}>
                <Copy /> Copiar URL pública
              </DropdownMenuItem>
              <DropdownMenuItem
                render={<a href={publicHref} target="_blank" rel="noopener noreferrer" />}
              >
                <ExternalLink /> Ver página
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="size-3.5" /> {formatCompact(presell.views)}
          </span>
          <span className="flex items-center gap-1">
            <MousePointerClick className="size-3.5" /> {formatCompact(presell.linkClicks)}
          </span>
          <span>{formatDateTime(presell.createdAt)}</span>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-xs text-muted-foreground">Ativa</span>
          <Switch checked={active} onCheckedChange={handleToggleActive} />
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta pre-sell?</AlertDialogTitle>
            <AlertDialogDescription>
              A página pública deixa de existir. Links que apontam pra ela ficam sem destino
              associado, mas não são apagados.
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
    </Card>
  );
}
