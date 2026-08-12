"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Section } from "@/components/shell/section";
import { formatBRL } from "@/lib/format";
import { centsToMasked } from "@/lib/mask";
import { PercentInput } from "@/components/form/percent-input";
import { IntegerInput } from "@/components/form/integer-input";
import { MoneyInput } from "@/components/form/money-input";
import { updateDetectionSettingsAction } from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";
import { useActionToast } from "./use-action-toast";
import { SaveButton } from "./save-button";
import type { PublicSettings } from "./types";

interface DeteccaoTabProps {
  settings: PublicSettings;
  /// Defaults vêm de SETTINGS_SCHEMA (fonte da verdade), lidos no server component.
  defaults: {
    minDiscount: number;
    hotDiscount: number;
    minHistoryPoints: number;
    minPrice: number; // centavos
    minSoldQuantity: number;
  };
}

function valuesFrom(settings: PublicSettings) {
  return {
    minDiscount: String(settings.minDiscount),
    hotDiscount: String(settings.hotDiscount),
    minHistoryPoints: String(settings.minHistoryPoints),
    minPrice: centsToMasked(settings.minPrice),
    minSoldQuantity: String(settings.minSoldQuantity),
  };
}

export function DeteccaoTab({ settings, defaults }: DeteccaoTabProps) {
  const [state, formAction] = useActionState(updateDetectionSettingsAction, INITIAL_ACTION_STATE);
  useActionToast(state);

  const [values, setValues] = useState(valuesFrom(settings));
  const savedRef = useRef(values);

  useEffect(() => {
    if (state.ok && state.ts) savedRef.current = values;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ts]);

  const dirty = JSON.stringify(values) !== JSON.stringify(savedRef.current);
  const err = (key: string) => state.errors?.[key]?.[0];
  const set = (key: keyof typeof values) => (v: string) => setValues((s) => ({ ...s, [key]: v }));

  return (
    <form action={formAction}>
      <Section
        title="Detecção de ofertas"
        description="Define quando uma queda de preço vira oferta e o que a varredura ignora."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <PercentInput
            label="Desconto mínimo"
            hint="Só vira oferta o produto que estiver pelo menos esse percentual abaixo da referência de preço."
            defaultText={`Padrão: ${defaults.minDiscount}%`}
            name="minDiscount"
            value={values.minDiscount}
            onValueChange={set("minDiscount")}
            error={err("minDiscount")}
          />
          <PercentInput
            label='Desconto "imperdível"'
            hint="A partir deste percentual a oferta é destacada como imperdível."
            defaultText={`Padrão: ${defaults.hotDiscount}%`}
            name="hotDiscount"
            value={values.hotDiscount}
            onValueChange={set("hotDiscount")}
            error={err("hotDiscount")}
          />
          <IntegerInput
            label="Pontos mínimos de histórico"
            hint="Quantas varreduras o produto precisa ter pro histórico contar como referência de preço."
            defaultText={`Padrão: ${defaults.minHistoryPoints}`}
            name="minHistoryPoints"
            min={1}
            max={50}
            value={values.minHistoryPoints}
            onValueChange={set("minHistoryPoints")}
            error={err("minHistoryPoints")}
          />
          <MoneyInput
            label="Preço mínimo"
            hint="Ignora ofertas de produtos abaixo deste preço, evitando lixo de R$ 1."
            defaultText={`Padrão: ${formatBRL(defaults.minPrice)}`}
            name="minPrice"
            min={0}
            value={values.minPrice}
            onValueChange={set("minPrice")}
            error={err("minPrice")}
          />
          <IntegerInput
            label="Vendas mínimas"
            hint="Ignora produtos com menos vendas do que isso (0 não filtra por vendas)."
            defaultText={`Padrão: ${defaults.minSoldQuantity}`}
            name="minSoldQuantity"
            min={0}
            value={values.minSoldQuantity}
            onValueChange={set("minSoldQuantity")}
            error={err("minSoldQuantity")}
          />
        </div>
        <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
          <SaveButton />
          {dirty && <span className="text-xs text-warning">Alterações não salvas</span>}
        </div>
      </Section>
    </form>
  );
}
