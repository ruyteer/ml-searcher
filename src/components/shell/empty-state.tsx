import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import type { AppIcon } from "@/components/icons";

export interface EmptyStateProps {
  icon?: AppIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/// Placeholder para listas e seções vazias (nenhuma oferta encontrada, nenhum
/// link criado etc.), com ação opcional (ex.: botão "Buscar ofertas").
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center",
        className
      )}
    >
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <HugeiconsIcon icon={icon} size={20} strokeWidth={1.6} aria-hidden="true" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-heading text-sm font-medium text-foreground">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
