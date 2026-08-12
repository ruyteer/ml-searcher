"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Section } from "@/components/shell/section";
import { formatBRL, fromCents } from "@/lib/format";
import { updateDetectionSettingsAction } from "./actions";
import { INITIAL_ACTION_STATE } from "./action-state";
import { useActionToast } from "./use-action-toast";
import { SaveButton } from "./save-button";
import { Field } from "./field";
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
    minPrice: fromCents(settings.minPrice).toFixed(2),
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
          <Field
            label="Desconto mínimo (%)"
            help='Só vira oferta o produto que estiver pelo menos X% abaixo da referência de preço.'
            defaultText={`Padrão: ${defaults.minDiscount}%`}
            name="minDiscount"
            type="number"
            min={0}
            max={100}
            value={values.minDiscount}
            onValueChange={set("minDiscount")}
            error={err("minDiscount")}
          />
          <Field
            label='Desconto "imperdível" (%)'
            help='A partir deste percentual a oferta é destacada como imperdível.'
            defaultText={`Padrão: ${defaults.hotDiscount}%`}
            name="hotDiscount"
            type="number"
            min={0}
            max={100}
            value={values.hotDiscount}
            onValueChange={set("hotDiscount")}
            error={err("hotDiscount")}
          />
          <Field
            label="Pontos mínimos de histórico"
            help="Quantas varreduras o produto precisa ter pro histórico contar como referência de preço."
            defaultText={`Padrão: ${defaults.minHistoryPoints}`}
            name="minHistoryPoints"
            type="number"
            min={1}
            max={50}
            value={values.minHistoryPoints}
            onValueChange={set("minHistoryPoints")}
            error={err("minHistoryPoints")}
          />
          <Field
            label="Preço mínimo (R$)"
            help="Ignora ofertas de produtos abaixo deste preço — evita lixo de R$ 1."
            defaultText={`Padrão: ${formatBRL(defaults.minPrice)}`}
            name="minPrice"
            type="number"
            min={0}
            step="0.01"
            value={values.minPrice}
            onValueChange={set("minPrice")}
            error={err("minPrice")}
          />
          <Field
            label="Vendas mínimas"
            help="Ignora produtos com menos vendas do que isso (0 = não filtra por vendas)."
            defaultText={`Padrão: ${defaults.minSoldQuantity}`}
            name="minSoldQuantity"
            type="number"
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
