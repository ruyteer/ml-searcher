"use client";

import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps extends Omit<ComponentProps<typeof Input>, "onChange"> {
  label: string;
  name: string;
  help?: string;
  defaultText?: string;
  error?: string;
  /// Uso controlado (state no componente pai). Sem isso o input fica
  /// não-controlado (defaultValue), útil em diálogos que resetam por `key`.
  onValueChange?: (value: string) => void;
}

/// Input com label, texto de ajuda, valor padrão exibido ao lado e erro de
/// validação — a unidade básica de campo usada em todos os forms da página.
export function Field({ label, name, help, defaultText, error, className, onValueChange, ...rest }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={name}>{label}</Label>
        {defaultText && <span className="text-xs text-muted-foreground">{defaultText}</span>}
      </div>
      <Input
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
        className={cn(className)}
        {...rest}
      />
      {help && !error && <p className="text-xs text-muted-foreground">{help}</p>}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
