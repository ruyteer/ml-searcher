"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { normalizeUrl } from "@/lib/mask";
import { FieldShell } from "./field-shell";
import { useTouched } from "./use-touched";

interface UrlInputProps {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  defaultText?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  className?: string;
  disabled?: boolean;
}

function urlError(value: string, required?: boolean): string | undefined {
  if (!value) return required ? "Informe um link." : undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Use um link que comece com http:// ou https://.";
    }
  } catch {
    return "Digite um link válido, por exemplo https://seusite.com.";
  }
  return undefined;
}

/// Campo de URL: completa "https://" automaticamente ao sair do campo se a
/// pessoa não digitou nenhum protocolo, e só mostra erro de formato depois
/// desse primeiro blur.
export function UrlInput({
  name,
  label,
  hint,
  error,
  defaultValue = "",
  value,
  onValueChange,
  defaultText,
  placeholder = "https://...",
  required,
  id,
  className,
  disabled,
}: UrlInputProps) {
  const autoId = useId();
  const fieldId = id ?? name ?? autoId;
  // Estado interno só é usado no modo não controlado (sem `value`); quando
  // controlado, `display` sempre reflete a prop `value` diretamente.
  const [internal, setInternal] = useState(defaultValue);
  const [touched, markTouched] = useTouched();

  const display = value !== undefined ? value : internal;

  function handleChange(raw: string) {
    if (value === undefined) setInternal(raw);
    onValueChange?.(raw);
  }

  function handleBlur() {
    markTouched();
    const normalized = normalizeUrl(display);
    if (normalized !== display) {
      if (value === undefined) setInternal(normalized);
      onValueChange?.(normalized);
    }
  }

  const localError = touched ? urlError(display, required) : undefined;
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
        type="text"
        inputMode="url"
        autoComplete="off"
        placeholder={placeholder}
        value={display}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        aria-invalid={Boolean(shownError)}
        aria-describedby={shownError ? errorId : hint ? hintId : undefined}
        className={className}
      />
    </FieldShell>
  );
}
