"use client";

import { useActionState, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconAlerta, IconBuscar, IconFechar, IconInfo, IconCarregando } from "@/components/icons";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { IntegerInput } from "@/components/form/integer-input";
import { PercentInput } from "@/components/form/percent-input";
import { FieldShell } from "@/components/form/field-shell";
import { maskCategoryId } from "@/lib/mask";
import { Field } from "./field";
import { AlertBox } from "./alert-box";
import { createWatchAction, updateWatchAction, discoverDomainsAction } from "./actions";
import { INITIAL_ACTION_STATE, type DiscoveredDomainOption } from "./action-state";
import { useActionToast } from "./use-action-toast";
import { SaveButton } from "./save-button";
import type { Watch } from "@/generated/prisma";

/// Maiúsculas, sem espaço nem caractere fora de A-Z 0-9 hífen sublinhado.
/// Só corta o que digitar errado: o formato completo é conferido pelo zod.
function maskDomainId(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

interface WatchDialogProps {
  open: boolean;
  watch: Watch | null;
  onOpenChange: (open: boolean) => void;
}

/// Cria ou edita uma categoria monitorada. O pai remonta este
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
  const [domainId, setDomainId] = useState(watch?.domainId ?? "");
  const [limit, setLimit] = useState(String(watch?.limit ?? 100));
  const [minDiscount, setMinDiscount] = useState(watch?.minDiscount != null ? String(watch.minDiscount) : "");

  // Resultado do botão "Descobrir domínio". null = ainda não buscou nesta
  // sessão do diálogo; [] = buscou e não achou nada, o que é normal.
  const [domainOptions, setDomainOptions] = useState<DiscoveredDomainOption[] | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const suggestDiscovery = query.trim() !== "" && domainId.trim() === "";

  async function handleDiscover() {
    setDiscovering(true);
    setDomainError(null);
    const result = await discoverDomainsAction(query);
    setDiscovering(false);
    if (!result.ok) {
      setDomainError(result.message);
      return;
    }
    setDomainOptions(result.domains);
  }

  function pickDomain(option: DiscoveredDomainOption) {
    setDomainId(option.domainId);
    setDomainOptions(null);
  }

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
              O código de categoria do Mercado Livre identifica uma categoria oficial (ex.: MLB264787 =
              Barbearia). Preenchendo um termo de busca, a coleta passa a varrer o catálogo do
              Mercado Livre por esse termo, o que alcança muito mais produto do que só os destaques
              da categoria.
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
              label="Código da categoria"
              name="categoryId"
              value={categoryId}
              onValueChange={(v) => setCategoryId(maskCategoryId(v))}
              placeholder="Ex.: MLB264787"
              help="Prefixo do site (MLB, MLA...) seguido de números."
              error={err("categoryId")}
            />
            <Field
              label="Termo de busca"
              name="query"
              value={query}
              onValueChange={setQuery}
              placeholder="Ex.: barbeador aparador"
              error={err("query")}
            />
          </div>

          <FieldShell
            id="watch-domainId"
            label="Tipo de produto (opcional)"
            hint="Sem o tipo de produto, a busca varre o catálogo inteiro e pode trazer coisa de outra área. Com ele, a busca já sai filtrada na origem: acha mais oferta boa em menos tempo. Descubra o tipo certo a partir do termo de busca ao lado ou digite na mão."
            error={err("domainId")}
          >
            <div className="flex items-center gap-2">
              <Input
                id="watch-domainId"
                name="domainId"
                value={domainId}
                onChange={(e) => setDomainId(maskDomainId(e.target.value))}
                placeholder="Ex.: MLB-RAZOR_BLADES"
                className="font-mono uppercase"
                aria-invalid={Boolean(err("domainId"))}
              />
              {domainId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDomainId("")}
                  title="Limpar tipo de produto"
                >
                  <HugeiconsIcon icon={IconFechar} size={14} strokeWidth={1.6} aria-hidden="true" />
                  <span className="sr-only">Limpar tipo de produto</span>
                </Button>
              )}
            </div>
          </FieldShell>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!query.trim() || discovering}
                onClick={handleDiscover}
              >
                {discovering ? (
                  <HugeiconsIcon icon={IconCarregando} size={14} strokeWidth={1.8} className="animate-spin" aria-hidden="true" />
                ) : (
                  <HugeiconsIcon icon={IconBuscar} size={14} strokeWidth={1.6} aria-hidden="true" />
                )}
                {discovering ? "Buscando..." : "Descobrir tipo de produto"}
              </Button>
              {!query.trim() && (
                <span className="text-xs text-muted-foreground">Digite o termo de busca acima primeiro.</span>
              )}
            </div>

            {suggestDiscovery && !discovering && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <HugeiconsIcon icon={IconInfo} size={13} strokeWidth={1.6} className="mt-0.5 shrink-0" aria-hidden="true" />
                Dica: esta categoria tem termo de busca mas nenhum tipo de produto. Descubra o tipo para
                restringir a busca e evitar produto fora do nicho.
              </p>
            )}

            {domainError && (
              <AlertBox icon={IconAlerta} variant="danger">
                {domainError}
              </AlertBox>
            )}

            {domainOptions && (
              domainOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum tipo de produto encontrado para &quot;{query}&quot;. Pode digitar na mão, se souber, ou
                  deixar o campo vazio para buscar sem filtro.
                </p>
              ) : (
                <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1.5">
                  {domainOptions.map((option) => (
                    <li key={option.domainId}>
                      <button
                        type="button"
                        onClick={() => pickDomain(option)}
                        className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                      >
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs">{option.domainId}</span>
                          <span className="text-sm">{option.domainName}</span>
                          {option.beauty && (
                            <Badge variant="secondary" className="text-[10px]">
                              Dentro do nicho
                            </Badge>
                          )}
                        </span>
                        {option.categoryName && (
                          <span className="text-xs text-muted-foreground">
                            {option.categoryName} ({option.categoryId})
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <IntegerInput
              label="Limite por varredura"
              name="limit"
              min={10}
              max={1000}
              value={limit}
              onValueChange={setLimit}
              hint="Entre 10 e 1000 itens (padrão: 100)."
              error={err("limit")}
            />
            <PercentInput
              label="Desconto mínimo próprio"
              name="minDiscount"
              min={0}
              max={90}
              value={minDiscount}
              onValueChange={setMinDiscount}
              placeholder="Herda o global"
              hint="Deixe vazio para usar o desconto mínimo global."
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
