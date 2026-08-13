"use client";

import { useActionState, useMemo, useState } from "react";
import { Section } from "@/components/shell/section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveScheduleAction } from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";
import { SaveButton } from "./save-button";
import { useActionToast } from "./use-action-toast";

export interface ScheduleFormProps {
  schedule: {
    enabled: boolean;
    intervalMinutes: number;
    minPerCycle: number;
    maxPerCycle: number;
    usePresell: boolean;
    presellId: string;
  };
  presells: { id: string; title: string }[];
}

/// Valor do Select quando "usa o modelo padrão" (nenhuma pre-sell escolhida
/// à dedo) — o Select não aceita item com value="".
const DEFAULT_PRESELL_VALUE = "__default__";

export function ScheduleForm({ schedule, presells }: ScheduleFormProps) {
  const [state, formAction] = useActionState(saveScheduleAction, INITIAL_ACTION_STATE);
  useActionToast(state);

  const [enabled, setEnabled] = useState(schedule.enabled);
  const [usePresell, setUsePresell] = useState(schedule.usePresell);
  const [presellId, setPresellId] = useState(schedule.presellId || DEFAULT_PRESELL_VALUE);

  // O Select fica fora da árvore até `usePresell` ligar, então o popup nunca
  // chegou a registrar os itens — sem passar a lista pronta aqui, o gatilho
  // mostra o value cru (ex. "__default__") em vez do rótulo.
  const presellItems = useMemo<Record<string, string>>(
    () => ({
      [DEFAULT_PRESELL_VALUE]: "Modelo padrão (marcado em /presells)",
      ...Object.fromEntries(presells.map((p) => [p.id, p.title])),
    }),
    [presells],
  );

  return (
    <Section
      title="Envio automático"
      description="A cada ciclo, sorteia entre o mínimo e o máximo de ofertas e manda pros grupos habilitados. Quando as ofertas disponíveis acabam, faz uma nova varredura sozinho antes de continuar."
    >
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
          <div className="flex flex-col">
            <Label htmlFor="whatsappEnabled">Ativado</Label>
            <span className="text-xs text-muted-foreground">Desligado não manda nada, mesmo com grupos habilitados.</span>
          </div>
          <Switch
            id="whatsappEnabled"
            name="whatsappEnabled"
            value="true"
            uncheckedValue="false"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whatsappIntervalMinutes">Intervalo (minutos)</Label>
            <Input
              id="whatsappIntervalMinutes"
              name="whatsappIntervalMinutes"
              type="number"
              min={5}
              max={1440}
              defaultValue={schedule.intervalMinutes}
              aria-invalid={Boolean(state.errors?.whatsappIntervalMinutes)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whatsappMinPerCycle">Mínimo de ofertas por ciclo</Label>
            <Input
              id="whatsappMinPerCycle"
              name="whatsappMinPerCycle"
              type="number"
              min={1}
              defaultValue={schedule.minPerCycle}
              aria-invalid={Boolean(state.errors?.whatsappMinPerCycle)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whatsappMaxPerCycle">Máximo de ofertas por ciclo</Label>
            <Input
              id="whatsappMaxPerCycle"
              name="whatsappMaxPerCycle"
              type="number"
              min={1}
              defaultValue={schedule.maxPerCycle}
              aria-invalid={Boolean(state.errors?.whatsappMaxPerCycle)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
          <div className="flex flex-col">
            <Label htmlFor="whatsappUsePresell">Link com pre-sell</Label>
            <span className="text-xs text-muted-foreground">
              Desligado manda o link rastreado direto. Ligado, passa pela página de pre-sell antes.
            </span>
          </div>
          <Switch
            id="whatsappUsePresell"
            name="whatsappUsePresell"
            value="true"
            uncheckedValue="false"
            checked={usePresell}
            onCheckedChange={setUsePresell}
          />
        </div>

        {usePresell && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whatsappPresellId">Modelo de pre-sell</Label>
            <Select
              items={presellItems}
              name="whatsappPresellId"
              value={presellId}
              onValueChange={(v) => setPresellId(v ?? DEFAULT_PRESELL_VALUE)}
            >
              <SelectTrigger id="whatsappPresellId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_PRESELL_VALUE}>Modelo padrão (marcado em /presells)</SelectItem>
                {presells.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {presells.length === 0 && (
              <span className="text-xs text-muted-foreground">
                Nenhuma pre-sell ativa ainda — vai cair no modelo padrão assim que tiver uma.
              </span>
            )}
          </div>
        )}

        <div className="border-t border-border pt-4">
          <SaveButton />
        </div>
      </form>
    </Section>
  );
}
