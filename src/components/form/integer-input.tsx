"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { maskInteger } from "@/lib/mask";
import { FieldShell } from "./field-shell";
import { useTouched } from "./use-touched";

interface IntegerInputProps {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  defaultText?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  required?: boolean;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/// Campo de número inteiro simples, com corte de faixa opcional. O mínimo
/// não é forçado enquanto a pessoa digita (senão nunca daria pra digitar
/// "1" de "15" com min 10) — só o máximo, e a validação final do mínimo
/// acontece depois do blur.
export function IntegerInput({
  name,
  label,
  hint,
  error,
  defaultValue = "",
  value,
  onValueChange,
  defaultText,
  placeholder,
  min,
  max,
  required,
  id,
  className,
  disabled,
}: IntegerInputProps) {
  const autoId = useId();
  const fieldId = id ?? name ?? autoId;
  // Estado interno só é usado no modo não controlado (sem `value`); quando
  // controlado, `display` sempre reflete a prop `value` diretamente.
  const [internal, setInternal] = useState(defaultValue);
  const [touched, markTouched] = useTouched();

  const display = value !== undefined ? value : internal;

  function handleChange(raw: string) {
    const masked = maskInteger(raw, { min, max });
    if (value === undefined) setInternal(masked);
    onValueChange?.(masked);
  }

  let localError: string | undefined;
  if (touched) {
    if (!display) {
      if (required) localError = "Preencha este campo.";
    } else {
      const n = Number(display);
      if (min != null && max != null && n < min) {
        localError = `Digite um valor entre ${min} e ${max}.`;
      } else if (min != null && n < min) {
        localError = `Digite um valor de pelo menos ${min}.`;
      } else if (max != null && n > max) {
        localError = `Digite um valor de até ${max}.`;
      }
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
      <Input
        id={fieldId}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={display}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={markTouched}
        aria-invalid={Boolean(shownError)}
        aria-describedby={shownError ? errorId : hint ? hintId : undefined}
        className={cn("tabular-nums", className)}
      />
    </FieldShell>
  );
}
