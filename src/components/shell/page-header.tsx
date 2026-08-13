import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/// Cabeçalho padrão de página: título + descrição opcional à esquerda,
/// ações (botões, filtros) à direita. Usado no topo do conteúdo de cada rota.
///
/// No celular ele encolhe: título menor, descrição menor e menos respiro
/// entre as partes. Cabeçalho grande numa tela de 360px empurra a lista de
/// ofertas para fora do quadro, e a lista é o que a pessoa veio ver.
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5 sm:gap-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {title}
        </h2>
        {description && (
          <p className="text-[0.8125rem] leading-snug text-muted-foreground sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
