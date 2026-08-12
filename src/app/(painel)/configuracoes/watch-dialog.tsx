"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Field } from "./field";
import { AlertBox } from "./alert-box";
import { createWatchAction, updateWatchAction } from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";
import { useActionToast } from "./use-action-toast";
import { SaveButton } from "./save-button";
import type { Watch } from "@/generated/prisma";

interface WatchDialogProps {
  open: boolean;
  watch: Watch | null;
  onOpenChange: (open: boolean) => void;
}

/// Cria ou edita uma categoria monitorada (Watch). O pai remonta este
/// componente via `key` a cada abertura — evita defaultValue "grudado" de
/// uma edição anterior quando o dialog é reaberto com outro alvo.
export function WatchDialog({ open, watch, onOpenChange }: WatchDialogProps) {
  const isEdit = Boolean(watch);
  const action = isEdit ? updateWatchAction : createWatchAction;
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);
  useActionToast(state);

  const [enabled, setEnabled] = useState(watch?.enabled ?? true);
  const [categoryId, setCategoryId] = useState(watch?.categoryId ?? "");
  const [query, setQuery] = useState(watch?.query ?? "");
  const searchOnly = categoryId.trim() === "" && query.trim() !== "";

  // Fecha o dialog automaticamente quando a action retorna sucesso.
  useEffect(() => {
    if (state.ok && state.ts) onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

  const err = (key: string) => state.errors?.[key]?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar categoria monitorada" : "Nova categoria monitorada"}</DialogTitle>
            <DialogDescription>
              O ID de categoria do Mercado Livre identifica uma categoria oficial (ex.: MLB1246 = Beleza
              e Cuidado Pessoal). O termo de busca está indisponível no momento — o Mercado Livre bloqueou
              a API de busca para esta aplicação — então a coleta hoje depende do ID de categoria.
            </DialogDescription>
          </DialogHeader>

          {isEdit && watch && <input type="hidden" name="id" value={watch.id} />}

          <Field
            label="Rótulo"
            name="label"
            defaultValue={watch?.label ?? ""}
            placeholder="Ex.: Barbearia"
            error={err("label")}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="ID de categoria"
              name="categoryId"
              value={categoryId}
              onValueChange={setCategoryId}
              placeholder="Ex.: MLB1246"
              error={err("categoryId")}
            />
            <Field
              label="Termo de busca"
              name="query"
              value={query}
              onValueChange={setQuery}
              placeholder="Indisponível no momento"
              error={err("query")}
            />
          </div>

          {searchOnly && (
            <AlertBox icon={AlertTriangle} variant="warning">
              Sem ID de categoria, esta watch não coleta nada agora — a busca por termo está bloqueada
              pelo Mercado Livre. Preencha o ID de categoria ou deixe para quando a busca for liberada.
            </AlertBox>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Limite por varredura"
              name="limit"
              type="number"
              min={10}
              max={1000}
              defaultValue={String(watch?.limit ?? 100)}
              help="Entre 10 e 1000 itens (padrão: 100)."
              error={err("limit")}
            />
            <Field
              label="Desconto mínimo próprio (%)"
              name="minDiscount"
              type="number"
              min={0}
              max={90}
              defaultValue={watch?.minDiscount != null ? String(watch.minDiscount) : ""}
              placeholder="Herdar do global"
              help="Vazio = usa o desconto mínimo global."
              error={err("minDiscount")}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div className="flex flex-col">
              <Label htmlFor="watch-enabled">Ligada</Label>
              <span className="text-xs text-muted-foreground">
                Desligada não entra na próxima varredura.
              </span>
            </div>
            <Switch
              id="watch-enabled"
              name="enabled"
              value="true"
              uncheckedValue="false"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <SaveButton label={isEdit ? "Salvar alterações" : "Criar categoria"} pendingLabel="Salvando..." />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
