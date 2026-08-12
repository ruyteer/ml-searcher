import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import type { AppIcon } from "@/components/icons";

interface AlertBoxProps {
  icon?: AppIcon;
  variant?: "info" | "warning" | "danger" | "success";
  title?: string;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<AlertBoxProps["variant"]>, string> = {
  info: "border-border bg-muted/50 text-foreground",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  success: "border-success/30 bg-success/10 text-success",
};

/// Caixa de aviso simples (não existe um componente Alert no design system
/// ainda) — usada pro modo demonstração e pelos avisos de configuração incompleta.
export function AlertBox({ icon, variant = "info", title, children, className }: AlertBoxProps) {
  return (
    <div className={cn("flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm", VARIANT_CLASSES[variant], className)}>
      {icon && <HugeiconsIcon icon={icon} size={16} strokeWidth={1.6} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <div className="flex flex-col gap-1.5">
        {title && <p className="font-medium">{title}</p>}
        <div className="flex flex-col gap-1 text-sm text-current/90 [&_a]:underline [&_a]:underline-offset-2 [&_ol]:list-decimal [&_ol]:space-y-0.5 [&_ol]:pl-4">
          {children}
        </div>
      </div>
    </div>
  );
}
