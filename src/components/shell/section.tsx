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

/// Bloco de card com título, descrição e ações opcionais mais o conteúdo. É a
/// unidade básica das páginas do painel (tabelas, gráficos, formulários).
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
          {/* No celular as ações caem para baixo do título: lado a lado elas
              espremem o texto até virar duas letras por linha. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="flex min-w-0 flex-col gap-0.5 sm:gap-1">
              {title && <CardTitle>{title}</CardTitle>}
              {description && (
                <CardDescription className="text-[0.8125rem] leading-snug sm:text-sm">
                  {description}
                </CardDescription>
              )}
            </div>
            {actions && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
    </Card>
  );
}
