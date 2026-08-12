"use client";

import { useTransition } from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CopyButtonProps {
  /// Resolve a URL a copiar. Pode disparar uma Server Action (ex.: gerar o
  /// link antes de copiar), por isso é assíncrona.
  getUrl: () => Promise<string> | string;
  label?: string;
  successMessage?: string;
  variant?: "outline" | "ghost" | "secondary" | "default";
  size?: "default" | "sm" | "xs" | "icon" | "icon-sm";
  className?: string;
}

/// Botão de copiar genérico: resolve a URL, copia pro clipboard e mostra
/// toast do sonner. Usado tanto no card de oferta quanto no detalhe do produto.
export function CopyButton({
  getUrl,
  label = "Copiar",
  successMessage = "Link copiado",
  variant = "outline",
  size = "sm",
  className,
}: CopyButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      try {
        const url = await getUrl();
        await navigator.clipboard.writeText(url);
        toast.success(successMessage);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível copiar o link");
      }
    });
  };

  const isIcon = size === "icon" || size === "icon-sm";

  return (
    <Button variant={variant} size={size} className={cn(className)} onClick={handleClick} disabled={isPending}>
      {isPending ? <Loader2 className="animate-spin" /> : <Copy />}
      {!isIcon && label}
    </Button>
  );
}
