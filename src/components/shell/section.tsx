import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface SectionProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/// Bloco de card com título/descrição/ações opcionais + conteúdo — a unidade
/// básica de composição das páginas do painel (tabelas, gráficos, formulários).
export function Section({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: SectionProps) {
  return (
    <Card className={cn(className)}>
      {(title || description || actions) && (
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              {title && <CardTitle>{title}</CardTitle>}
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
    </Card>
  );
}
