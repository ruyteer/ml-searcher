"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CopyPlus, Loader2, Pencil, Trash2, ClipboardCopy } from "lucide-react";
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
}

export function PhraseRow({ phrase, onEdit }: PhraseRowProps) {
  const [isPending, startTransition] = useTransition();
  // Switch otimista: reflete o novo estado na hora, sem esperar o roundtrip.
  const [active, setActive] = useState(phrase.active);

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
      () => toast.success("Frase copiada."),
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
    <div className="flex items-center gap-3 py-2.5">
      <Switch checked={active} onCheckedChange={toggleActive} disabled={isPending} aria-label="Frase ativa" />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", active ? "text-foreground" : "text-muted-foreground line-through")}>
          {phrase.text}
        </p>
        <p className="text-xs text-muted-foreground">
          usada {phrase.usageCount} {phrase.usageCount === 1 ? "vez" : "vezes"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button type="button" variant="ghost" size="icon-sm" onClick={copy} aria-label="Copiar" title="Copiar">
          <ClipboardCopy className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={duplicate}
          disabled={isPending}
          aria-label="Duplicar"
          title="Duplicar"
        >
          <CopyPlus className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          disabled={isPending}
          aria-label="Editar"
          title="Editar"
        >
          <Pencil className="size-3.5" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                aria-label="Excluir"
                title="Excluir"
              />
            }
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
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
