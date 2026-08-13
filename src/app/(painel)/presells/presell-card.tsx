"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  IconCopiar,
  IconAbrirFora,
  IconVer,
  IconSemImagem,
  IconCliques,
  IconLinks,
  IconMaisOpcoes,
  IconEditar,
  IconExcluir,
  IconDuplicar,
  IconTrofeu,
} from "@/components/icons";
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
  setDefaultPresellAction,
  deletePresellAction,
  duplicatePresellAction,
} from "./actions";
import { PresellLinksDialog } from "./presell-links-dialog";
import type { PresellListRow } from "@/lib/data/presells";

interface PresellCardProps {
  presell: PresellListRow;
  /// URL pública completa do modelo aberto sozinho.
  publicHref: string;
  /// Origem pública, para montar a URL dos links do modelo.
  publicBase: string;
}

export function PresellCard({ presell, publicHref, publicBase }: PresellCardProps) {
  const router = useRouter();
  const [active, setActive] = useState(presell.active);
  const [isDefault, setIsDefault] = useState(presell.isDefault);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const [, startTransition] = useTransition();

  function handleToggleActive(next: boolean) {
    setActive(next);
    if (!next) setIsDefault(false);
    startTransition(async () => {
      try {
        await setPresellActiveAction(presell.id, next);
        router.refresh();
      } catch {
        setActive(!next);
        setIsDefault(presell.isDefault);
        toast.error("Não foi possível atualizar o modelo.");
      }
    });
  }

  function handleToggleDefault() {
    const next = !isDefault;
    setIsDefault(next);
    if (next) setActive(true);
    startTransition(async () => {
      try {
        await setDefaultPresellAction(presell.id, next);
        toast.success(
          next
            ? "Este modelo passa a ser o padrão."
            : "Este modelo não é mais o padrão.",
        );
        router.refresh();
      } catch {
        setIsDefault(!next);
        toast.error("Não foi possível alterar o modelo padrão.");
      }
    });
  }

  function handleCopy() {
    navigator.clipboard
      .writeText(publicHref)
      .then(() => toast.success("Endereço copiado."))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicatePresellAction(presell.id);
      if (result.success) {
        toast.success("Modelo duplicado.");
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
        toast.success("Modelo excluído.");
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
          <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <HugeiconsIcon icon={IconSemImagem} size={24} strokeWidth={1.5} aria-hidden="true" />
            <span className="px-3 text-center text-[11px] leading-tight">
              Mostra a foto de cada produto
            </span>
          </div>
        )}
        <Badge
          variant={active ? "default" : "outline"}
          className="absolute top-2 left-2 bg-background/80 backdrop-blur"
        >
          {active ? "Ativo" : "Desligado"}
        </Badge>
        {isDefault && (
          <Badge className="absolute top-2 right-2 bg-background/80 text-foreground backdrop-blur">
            <HugeiconsIcon icon={IconTrofeu} size={12} strokeWidth={1.8} aria-hidden="true" /> Padrão
          </Badge>
        )}
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
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="size-11 sm:size-7" />}>
              <HugeiconsIcon icon={IconMaisOpcoes} size={16} strokeWidth={1.8} aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<Link href={`/presells/${presell.id}`} />}>
                <HugeiconsIcon icon={IconEditar} size={16} strokeWidth={1.6} aria-hidden="true" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLinksOpen(true)}>
                <HugeiconsIcon icon={IconLinks} size={16} strokeWidth={1.6} aria-hidden="true" /> Ver links deste modelo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleDefault}>
                <HugeiconsIcon icon={IconTrofeu} size={16} strokeWidth={1.6} aria-hidden="true" />{" "}
                {isDefault ? "Deixar de ser o padrão" : "Usar como padrão"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDuplicate}>
                <HugeiconsIcon icon={IconDuplicar} size={16} strokeWidth={1.6} aria-hidden="true" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopy}>
                <HugeiconsIcon icon={IconCopiar} size={16} strokeWidth={1.6} aria-hidden="true" /> Copiar endereço
              </DropdownMenuItem>
              <DropdownMenuItem
                render={<a href={publicHref} target="_blank" rel="noopener noreferrer" />}
              >
                <HugeiconsIcon icon={IconAbrirFora} size={16} strokeWidth={1.6} aria-hidden="true" /> Ver página
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <HugeiconsIcon icon={IconExcluir} size={16} strokeWidth={1.6} aria-hidden="true" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <button
          type="button"
          onClick={() => setLinksOpen(true)}
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {presell.linkCount === 0
            ? "Nenhum produto usa este modelo ainda"
            : presell.linkCount === 1
              ? "1 produto usa este modelo"
              : `${presell.linkCount} produtos usam este modelo`}
        </button>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <HugeiconsIcon icon={IconVer} size={14} strokeWidth={1.6} aria-hidden="true" /> {formatCompact(presell.views)}
          </span>
          <span className="flex items-center gap-1">
            <HugeiconsIcon icon={IconCliques} size={14} strokeWidth={1.6} aria-hidden="true" /> {formatCompact(presell.linkClicks)}
          </span>
          <span>{formatDateTime(presell.createdAt)}</span>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-xs text-muted-foreground">Ativo</span>
          <Switch checked={active} onCheckedChange={handleToggleActive} />
        </div>
      </div>

      <PresellLinksDialog
        presellId={presell.id}
        presellTitle={presell.title}
        publicBase={publicBase}
        open={linksOpen}
        onOpenChange={setLinksOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              Os links já divulgados não são apagados: eles passam a usar o modelo marcado como
              padrão. Se não houver nenhum padrão, esses links deixam de abrir a página.
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
