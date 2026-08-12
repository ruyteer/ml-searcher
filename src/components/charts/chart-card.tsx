import { cn } from "@/lib/utils";
import { Section } from "@/components/shell/section";
import { EmptyState } from "@/components/shell/empty-state";
import type { AppIcon } from "@/components/icons";

export interface ChartCardProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /// Sem dado nenhum no período, mostra o EmptyState em vez do gráfico.
  isEmpty?: boolean;
  emptyIcon?: AppIcon;
  emptyMessage?: string;
  emptyDescription?: string;
  /// Altura em px da área do gráfico. Com `fillHeight`, vira só o piso
  /// mínimo — o ResponsiveContainer do recharts precisa de um pai com
  /// altura definida, então isso é sempre aplicado aqui de um jeito ou de
  /// outro.
  height?: number;
  /// Quando true, o card cresce para ocupar 100% da altura da linha do
  /// grid em vez de parar numa altura fixa em pixels — usado pra igualar a
  /// altura de uma coluna com a da coluna vizinha (evita sobra de espaço
  /// em branco quando os dois lados têm conteúdo de tamanho diferente).
  fillHeight?: boolean;
  className?: string;
  children: React.ReactNode;
}

/// Wrapper padrão para os cards de gráfico do dashboard: título + descrição
/// (via Section) + área do gráfico + estado vazio.
export function ChartCard({
  title,
  description,
  actions,
  isEmpty,
  emptyIcon,
  emptyMessage = "Sem dados neste período",
  emptyDescription,
  height = 280,
  fillHeight = false,
  className,
  children,
}: ChartCardProps) {
  return (
    <Section
      title={title}
      description={description}
      actions={actions}
      className={cn(fillHeight && "flex h-full flex-col", className)}
      contentClassName={fillHeight ? "flex flex-1 flex-col" : undefined}
    >
      <div
        style={fillHeight ? { minHeight: height } : { height }}
        className={cn("w-full", fillHeight && "flex-1")}
      >
        {isEmpty ? (
          <EmptyState
            icon={emptyIcon}
            title={emptyMessage}
            description={emptyDescription}
            className="h-full justify-center border-none py-0"
          />
        ) : (
          children
        )}
      </div>
    </Section>
  );
}
