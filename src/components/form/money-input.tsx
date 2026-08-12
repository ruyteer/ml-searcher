"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { maskMoney, moneyToCents } from "@/lib/mask";
import { FieldShell } from "./field-shell";
import { useTouched } from "./use-touched";

interface MoneyInputProps {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  /// Valor mascarado inicial, ex.: "1.234,56". Ao carregar um valor vindo do
  /// banco (em centavos), converta antes com centsToMasked().
  defaultValue?: string;
  /// Uso controlado: value + onValueChange (mascarados). Sem isso o campo
  /// mantém o próprio estado a partir de defaultValue.
  value?: string;
  onValueChange?: (masked: string) => void;
  defaultText?: string;
  placeholder?: string;
  /// Limites em REAIS (não centavos), só para a mensagem de erro do cliente.
  min?: number;
  max?: number;
  required?: boolean;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/// Campo de dinheiro: prefixo "R$" fixo dentro do campo, texto alinhado à
/// direita com números tabulares, digitação mascarada em pt-BR ("1.234,56").
///
/// O input visível nunca é o que vai no FormData: como a máscara usa ponto
/// como separador de milhar, isso quebraria o toCents() de src/lib/format.ts
/// (que só troca a primeira vírgula por ponto). Por isso este componente
/// manda o valor de verdade num input escondido, em formato numérico simples
/// ("1234.56"), compatível com toCents() e com z.coerce.number().
export function MoneyInput({
  name,
  label,
  hint,
  error,
  defaultValue = "",
  value,
  onValueChange,
  defaultText,
  placeholder = "0,00",
  min = 0,
  max,
  required,
  id,
  className,
  disabled,
}: MoneyInputProps) {
  const autoId = useId();
  const fieldId = id ?? name ?? autoId;
  // Estado interno só é usado no modo não controlado (sem `value`); quando
  // controlado, `display` sempre reflete a prop `value` diretamente, sem
  // precisar sincronizar em efeito.
  const [internal, setInternal] = useState(defaultValue);
  const [touched, markTouched] = useTouched();

  const display = value !== undefined ? value : internal;

  function handleChange(raw: string) {
    const masked = maskMoney(raw);
    if (value === undefined) setInternal(masked);
    onValueChange?.(masked);
  }

  const reais = display ? moneyToCents(display) / 100 : 0;

  let localError: string | undefined;
  if (touched) {
    if (!display) {
      if (required) localError = "Informe um valor.";
    } else if (reais < min) {
      localError = `Digite um valor de pelo menos R$ ${min.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`;
    } else if (max != null && reais > max) {
      localError = `Digite um valor de até R$ ${max.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`;
    }
  }
  const shownError = error ?? localError;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;

  return (
    <FieldShell
      id={fieldId}
      label={label}
      defaultText={defaultText}
      hint={hint}
      error={shownError}
      required={required}
    >
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
          R$
        </span>
        <Input
          id={fieldId}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={display}
          disabled={disabled}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={markTouched}
          aria-invalid={Boolean(shownError)}
          aria-describedby={shownError ? errorId : hint ? hintId : undefined}
          className={cn("pl-9 text-right tabular-nums", className)}
        />
        <input type="hidden" name={name} value={display ? reais.toFixed(2) : ""} />
      </div>
    </FieldShell>
  );
}
