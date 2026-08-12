import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { FieldHint } from "./field-hint";
import { FieldError } from "./field-error";

interface FieldShellProps {
  id: string;
  label: string;
  defaultText?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

/// Moldura comum aos inputs de src/components/form: rótulo (+ texto de
/// padrão opcional ao lado) em cima, o campo em si, e hint ou erro embaixo.
export function FieldShell({ id, label, defaultText, hint, error, required, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-danger">*</span>}
        </Label>
        {defaultText && <span className="text-xs text-muted-foreground">{defaultText}</span>}
      </div>
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : <FieldHint id={`${id}-hint`}>{hint}</FieldHint>}
    </div>
  );
}
