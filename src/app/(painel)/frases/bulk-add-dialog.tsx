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
import { bulkCreatePhrases } from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";

export interface BulkAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
}

/// Cola uma lista pronta: cada linha da textarea vira uma Phrase da
/// categoria escolhida.
export function BulkAddDialog({ open, onOpenChange, categories }: BulkAddDialogProps) {
  const [state, formAction, isPending] = useActionState(bulkCreatePhrases, INITIAL_ACTION_STATE);
  const [category, setCategory] = useState(categories[0] ?? "geral");

  useEffect(() => {
    if (state === INITIAL_ACTION_STATE) return;
    if (state.success) {
      toast.success(state.message ?? "Frases adicionadas.");
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
            <DialogTitle>Adicionar várias frases</DialogTitle>
            <DialogDescription>Cada linha vira uma frase da categoria escolhida.</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="category" value={category} />

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Categoria</Label>
              <CategoryCombobox value={category} onChange={setCategory} categories={categories} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bulk-lines">Frases (uma por linha)</Label>
              <Textarea
                id="bulk-lines"
                name="lines"
                rows={8}
                placeholder={"🔥 ACHADO DO DIA\nCorre que é por tempo limitado ⏰"}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
