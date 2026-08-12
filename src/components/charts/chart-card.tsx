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
  /// Altura em px da área do gráfico. O ResponsiveContainer do recharts
  /// precisa de um pai com altura definida, então isso é aplicado aqui.
  height?: number;
  className?: string;
  children: React.ReactNode;
}

/// Wrapper padrão para os cards de gráfico do dashboard: título + descrição
/// (via Section) + área com altura fixa + estado vazio.
export function ChartCard({
  title,
  description,
  actions,
  isEmpty,
  emptyIcon,
  emptyMessage = "Sem dados neste período",
  emptyDescription,
  height = 280,
  className,
  children,
}: ChartCardProps) {
  return (
    <Section title={title} description={description} actions={actions} className={className}>
      <div style={{ height }} className="w-full">
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
