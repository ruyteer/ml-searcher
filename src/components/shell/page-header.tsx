import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/// Cabeçalho padrão de página: título + descrição opcional à esquerda,
/// ações (botões, filtros) à direita. Usado no topo do conteúdo de cada rota.
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
