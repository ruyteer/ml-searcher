"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CategoryCombobox } from "./category-combobox";
import { createPhrase, updatePhrase } from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";
import type { Phrase } from "@/generated/prisma";

export interface PhraseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /// null = criar nova frase; presente = editar esta frase.
  phrase: Phrase | null;
  categories: string[];
}

export function PhraseDialog({ open, onOpenChange, phrase, categories }: PhraseDialogProps) {
  const action = phrase ? updatePhrase : createPhrase;
  const [state, formAction, isPending] = useActionState(action, INITIAL_ACTION_STATE);
  const [category, setCategory] = useState(phrase?.category ?? categories[0] ?? "geral");

  useEffect(() => {
    if (state === INITIAL_ACTION_STATE) return;
    if (state.success) {
      toast.success(state.message ?? "Salvo.");
      onOpenChange(false);
    } else if (state.message) {
      toast.error(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} className="contents">
          <DialogHeader>
            <DialogTitle>{phrase ? "Editar frase" : "Nova frase"}</DialogTitle>
            <DialogDescription>
              {phrase ? "Altere o texto ou a categoria da frase." : "Adicione uma frase ao banco."}
            </DialogDescription>
          </DialogHeader>

          {phrase && <input type="hidden" name="id" value={phrase.id} />}
          <input type="hidden" name="category" value={category} />

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phrase-text">Texto</Label>
              <Textarea id="phrase-text" name="text" defaultValue={phrase?.text} rows={3} maxLength={500} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Categoria</Label>
              <CategoryCombobox value={category} onChange={setCategory} categories={categories} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
