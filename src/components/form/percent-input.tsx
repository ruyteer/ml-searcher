"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { maskInteger } from "@/lib/mask";
import { FieldShell } from "./field-shell";
import { useTouched } from "./use-touched";

interface PercentInputProps {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  defaultText?: string;
  placeholder?: string;
  /// Padrão 0 a 100. Ex.: desconto mínimo por categoria vai só até 90.
  min?: number;
  max?: number;
  required?: boolean;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/// Percentual inteiro com sufixo "%". A máscara já bloqueia letras e
/// impede digitar acima do máximo enquanto a pessoa digita.
export function PercentInput({
  name,
  label,
  hint,
  error,
  defaultValue = "",
  value,
  onValueChange,
  defaultText,
  placeholder,
  min = 0,
  max = 100,
  required,
  id,
  className,
  disabled,
}: PercentInputProps) {
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
      if (n < min) localError = `Digite um valor entre ${min} e ${max}.`;
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
          className={cn("pr-7 tabular-nums", className)}
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm text-muted-foreground">
          %
        </span>
      </div>
    </FieldShell>
  );
}
