"use client";

import { useActionState, useState } from "react";
import { Section } from "@/components/shell/section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  };
}

export function ScheduleForm({ schedule }: ScheduleFormProps) {
  const [state, formAction] = useActionState(saveScheduleAction, INITIAL_ACTION_STATE);
  useActionToast(state);

  const [enabled, setEnabled] = useState(schedule.enabled);

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

        <div className="border-t border-border pt-4">
          <SaveButton />
        </div>
      </form>
    </Section>
  );
}
