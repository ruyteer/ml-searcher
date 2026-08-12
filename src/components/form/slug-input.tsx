"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { maskSlug } from "@/lib/mask";
import { FieldShell } from "./field-shell";
import { useTouched } from "./use-touched";

interface SlugInputProps {
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
  maxLength?: number;
  /// Caminho fixo antes do slug na URL pública final (ex.: "/p/").
  basePath?: string;
  /// Conteúdo extra ao lado do campo (ex.: ícone de status de disponibilidade).
  addon?: ReactNode;
}

const SLUG_FORMAT_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/// Campo de slug: máscara minúscula/sem acento/hífen enquanto digita, e
/// mostra embaixo, em cinza, a URL pública final que o slug vai gerar.
export function SlugInput({
  name,
  label,
  hint,
  error,
  defaultValue = "",
  value,
  onValueChange,
  defaultText,
  placeholder,
  required,
  id,
  className,
  disabled,
  maxLength,
  basePath = "/p/",
  addon,
}: SlugInputProps) {
  const autoId = useId();
  const fieldId = id ?? name ?? autoId;
  // Estado interno só é usado no modo não controlado (sem `value`); quando
  // controlado, `display` sempre reflete a prop `value` diretamente.
  const [internal, setInternal] = useState(defaultValue);
  const [touched, markTouched] = useTouched();
  // Só existe no cliente (evita mismatch de hidratação) — até montar, a
  // prévia usa um domínio de exemplo.
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const display = value !== undefined ? value : internal;

  function handleChange(raw: string) {
    const masked = maskSlug(raw);
    if (value === undefined) setInternal(masked);
    onValueChange?.(masked);
  }

  let localError: string | undefined;
  if (touched) {
    if (!display) {
      if (required) localError = "Informe um slug.";
    } else if (!SLUG_FORMAT_RE.test(display)) {
      localError = "Use letras minúsculas, números e hífen entre as palavras.";
    }
  }
  const shownError = error ?? localError;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const previewBase = origin || "https://seudominio.com.br";

  return (
    <FieldShell
      id={fieldId}
      label={label}
      defaultText={defaultText}
      hint={hint}
      error={shownError}
      required={required}
    >
      <div className="flex items-center gap-2">
        <Input
          id={fieldId}
          name={name}
          autoComplete="off"
          placeholder={placeholder}
          value={display}
          disabled={disabled}
          maxLength={maxLength}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={markTouched}
          aria-invalid={Boolean(shownError)}
          aria-describedby={shownError ? errorId : hint ? hintId : undefined}
          className={cn("font-mono", className)}
        />
        {addon}
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {previewBase}
        {basePath}
        <span className="text-foreground">{display || "seu-slug"}</span>
      </p>
    </FieldShell>
  );
}
