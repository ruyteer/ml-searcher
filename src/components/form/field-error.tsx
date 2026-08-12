import type { ReactNode } from "react";

interface FieldErrorProps {
  id?: string;
  children?: ReactNode;
}

/// Mensagem de erro padrão, usada abaixo de todos os inputs do form.
export function FieldError({ id, children }: FieldErrorProps) {
  if (!children) return null;
  return (
    <p id={id} className="text-xs text-danger" role="alert">
      {children}
    </p>
  );
}
