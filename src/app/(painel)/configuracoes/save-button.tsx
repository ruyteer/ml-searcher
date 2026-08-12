"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentProps, ReactNode } from "react";

interface SaveButtonProps extends Omit<ComponentProps<typeof Button>, "type" | "disabled"> {
  label?: string;
  pendingLabel?: string;
  children?: ReactNode;
}

/// Botão de submit com estado de pending refletido via useFormStatus — usado
/// em todos os forms da página pra nunca parecer travado durante o salvamento.
export function SaveButton({ label = "Salvar", pendingLabel = "Salvando...", children, ...props }: SaveButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending && <Loader2 className="size-3.5 animate-spin" />}
      {pending ? pendingLabel : (children ?? label)}
    </Button>
  );
}
