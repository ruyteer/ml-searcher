"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Copy01Icon,
  CopyPlusIcon,
  Delete02Icon,
  Edit02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Phrase } from "@/generated/prisma";
import { deletePhrase, duplicatePhrase, setPhraseActive } from "./actions";

export interface PhraseRowProps {
  phrase: Phrase;
  onEdit: () => void;
  /// Rótulo já resolvido do watch da frase ("Sem categoria" quando nulo) —
  /// o componente pai resolve porque `Phrase` só guarda o `watchId` (cuid).
  categoryLabel: string;
  /// Esconde o selo de categoria quando a lista já está filtrada por uma
  /// categoria só, pra não repetir a mesma informação em toda linha.
  showCategory?: boolean;
}

/// Linha compacta de uma frase: uma por linha, ações só aparecem no hover ou
/// foco. Pensado para telas com dezenas ou centenas de frases, onde um card
/// por item não escala. Clicar no texto já copia a frase.
export function PhraseRow({ phrase, onEdit, categoryLabel, showCategory = true }: PhraseRowProps) {
  const [isPending, startTransition] = useTransition();
  // Switch otimista: reflete o novo estado na hora, sem esperar o roundtrip.
  const [active, setActive] = useState(phrase.active);
  const [copied, setCopied] = useState(false);

  function toggleActive(next: boolean) {
    setActive(next);
    startTransition(async () => {
      const res = await setPhraseActive(phrase.id, next);
      if (!res.success) {
        setActive(!next);
        toast.error(res.message ?? "Erro ao atualizar a frase.");
      }
    });
  }

  function copy() {
    navigator.clipboard.writeText(phrase.text).then(
      () => {
        setCopied(true);
        toast.success("Frase copiada.");
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => toast.error("Não foi possível copiar."),
    );
  }

  function duplicate() {
    startTransition(async () => {
      const res = await duplicatePhrase(phrase.id);
      if (res.success) toast.success(res.message ?? "Frase duplicada.");
      else toast.error(res.message ?? "Erro ao duplicar.");
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deletePhrase(phrase.id);
      if (res.success) toast.success("Frase excluída.");
      else toast.error(res.message ?? "Erro ao excluir.");
    });
  }

  return (
    <div className="group/row relative flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted/60 focus-within:bg-muted/60">
      <Switch
        size="sm"
        checked={active}
        onCheckedChange={toggleActive}
        disabled={isPending}
        aria-label="Frase ativa"
        className="shrink-0"
      />
      <button
        type="button"
        onClick={copy}
        title="Toque para copiar a frase"
        className="min-h-11 min-w-0 flex-1 rounded px-1 py-0.5 text-left"
      >
        <span className={cn("block truncate text-sm", active ? "text-foreground" : "text-muted-foreground line-through")}>
          {phrase.text}
        </span>
      </button>
      {showCategory && (
        <span className="hidden shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
          {categoryLabel}
        </span>
      )}
      {/* No celular não existe hover: as ações ficam sempre visíveis e podem
          quebrar linha. No desktop, continuam aparecendo só no hover/foco. */}
      <div className="flex shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100">
        <Button type="button" variant="ghost" size="icon-sm" className="size-11 sm:size-7" onClick={copy} aria-label="Copiar" title="Copiar">
          {copied ? (
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} strokeWidth={1.5} className="text-primary" />
          ) : (
            <HugeiconsIcon icon={Copy01Icon} size={14} strokeWidth={1.5} />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-11 sm:size-7"
          onClick={duplicate}
          disabled={isPending}
          aria-label="Duplicar"
          title="Duplicar"
        >
          <HugeiconsIcon icon={CopyPlusIcon} size={14} strokeWidth={1.5} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-11 sm:size-7"
          onClick={onEdit}
          disabled={isPending}
          aria-label="Editar"
          title="Editar"
        >
          <HugeiconsIcon icon={Edit02Icon} size={14} strokeWidth={1.5} />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-11 sm:size-7"
                disabled={isPending}
                aria-label="Excluir"
                title="Excluir"
              />
            }
          >
            {isPending ? (
              <HugeiconsIcon icon={Loading03Icon} size={14} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.5} />
            )}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir frase?</AlertDialogTitle>
              <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
