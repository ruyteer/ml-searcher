import type { ReactNode } from "react";

interface FieldHintProps {
  id?: string;
  children?: ReactNode;
}

/// Texto de ajuda padrão, usado abaixo dos inputs quando não há erro.
export function FieldHint({ id, children }: FieldHintProps) {
  if (!children) return null;
  return (
    <p id={id} className="text-xs text-muted-foreground">
      {children}
    </p>
  );
}
