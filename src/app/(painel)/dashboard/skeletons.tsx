import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shell/stat-card";

/// Skeletons dos blocos do dashboard — cada Suspense tem o seu, aproximando
/// a forma final pra não haver salto de layout quando o dado chega.

function CardShell({ height, rows }: { height?: number; rows?: number }) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      {rows ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <Skeleton className="w-full flex-1" style={{ minHeight: height }} />
      )}
    </div>
  );
}

export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <StatCard key={i} label="" value="" loading />
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 320 }: { height?: number }) {
  return <CardShell height={height} />;
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return <CardShell rows={rows} />;
}

export function RunCardSkeleton() {
  return <CardShell rows={4} />;
}

/// Fallback do bloco inteiro de conteúdo (usado enquanto decide se mostra o
/// dashboard ou o EmptyState de "sem dado nenhum").
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <KpiRowSkeleton />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartSkeleton height={320} />
        </div>
        <div className="flex flex-col gap-6">
          <ChartSkeleton height={220} />
          <ChartSkeleton height={220} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ListSkeleton rows={6} />
        <ListSkeleton rows={6} />
        <RunCardSkeleton />
      </div>
    </div>
  );
}
