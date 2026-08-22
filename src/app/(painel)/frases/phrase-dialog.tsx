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
import { WordListInput } from "@/components/palavras/word-list-input";
import { formatWordList, parseWordList } from "@/lib/word-filter";
import { WatchCombobox, type WatchComboboxOption } from "./watch-combobox";
import { createPhrase, updatePhrase } from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";
import type { PhraseWithWatchIds } from "@/lib/data/phrases";

export interface PhraseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /// null = criar nova frase; presente = editar esta frase.
  phrase: PhraseWithWatchIds | null;
  watches: WatchComboboxOption[];
}

export function PhraseDialog({ open, onOpenChange, phrase, watches }: PhraseDialogProps) {
  const action = phrase ? updatePhrase : createPhrase;
  const [state, formAction, isPending] = useActionState(action, INITIAL_ACTION_STATE);
  const [watchIds, setWatchIds] = useState<string[]>(phrase?.watchIds ?? []);
  const [keywords, setKeywords] = useState<string[]>(parseWordList(phrase?.keywords ?? ""));

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
              {phrase
                ? "Altere o texto, a categoria ou as palavras-chave da frase."
                : "Adicione uma frase ao banco."}
            </DialogDescription>
          </DialogHeader>

          {phrase && <input type="hidden" name="id" value={phrase.id} />}
          {watchIds.map((id) => (
            <input key={id} type="hidden" name="watchIds" value={id} />
          ))}
          <input type="hidden" name="keywords" value={formatWordList(keywords)} />

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phrase-text">Texto</Label>
              <Textarea id="phrase-text" name="text" defaultValue={phrase?.text} rows={3} maxLength={500} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Categoria</Label>
              <WatchCombobox value={watchIds} onChange={setWatchIds} watches={watches} />
            </div>
            <div className="flex flex-col gap-1.5">
              <WordListInput
                id="phrase-keywords"
                titulo="Palavras-chave do produto"
                ajuda="Deixe vazio para a frase servir a qualquer produto da categoria. Com palavras aqui, a frase só é usada quando uma delas aparece no nome do produto. A palavra é comparada inteira — acento não importa, e plural/gênero entram junto (ex. &quot;kit&quot; também bate em &quot;kits&quot;)."
                placeholder="maquina, pelos, intimo"
                vazio="Nenhuma palavra-chave — a frase serve pra qualquer produto da categoria."
                palavras={keywords}
                onChange={setKeywords}
              />
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
