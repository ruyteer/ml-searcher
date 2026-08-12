import Link from "next/link";
import { IconVarredura } from "@/components/icons";
import type { RunStatus } from "@/generated/prisma";
import { Section } from "@/components/shell/section";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCompact, formatDateTime } from "@/lib/format";
import { getRecentScrapeRuns } from "@/lib/data/metrics";

const STATUS_LABEL: Record<RunStatus, string> = {
  RUNNING: "Em andamento",
  SUCCESS: "Concluída",
  FAILED: "Falhou",
  PARTIAL: "Parcial",
};

const STATUS_VARIANT: Record<RunStatus, "default" | "secondary" | "destructive" | "outline"> = {
  RUNNING: "secondary",
  SUCCESS: "default",
  FAILED: "destructive",
  PARTIAL: "outline",
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "em andamento";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes === 0 ? `${seconds}s` : `${minutes}min ${seconds}s`;
}

export async function LatestRunSection() {
  const runs = await getRecentScrapeRuns(5);
  const latest = runs[0];

  return (
    <Section
      title="Última varredura"
      description={latest ? formatDateTime(latest.startedAt) : undefined}
      actions={
        <Link href="/ofertas" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Ver ofertas
        </Link>
      }
      className="h-full"
    >
      {!latest ? (
        <EmptyState icon={IconVarredura} title="Nenhuma varredura ainda" className="border-none py-10" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[latest.status]}>{STATUS_LABEL[latest.status]}</Badge>
            <span className="text-xs text-muted-foreground">
              {latest.trigger === "cron" ? "Automática" : "Manual"} · {formatDuration(latest.durationMs)}
            </span>
          </div>

          {latest.error && <p className="text-xs text-danger">{latest.error}</p>}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Ofertas novas</span>
              <span className="font-semibold text-foreground">{formatCompact(latest.offersNew)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Produtos novos</span>
              <span className="font-semibold text-foreground">{formatCompact(latest.productsNew)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Itens vistos</span>
              <span className="font-semibold text-foreground">{formatCompact(latest.itemsSeen)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Watches</span>
              <span className="font-semibold text-foreground">
                {latest.watchesDone}/{latest.watchesTotal}
              </span>
            </div>
          </div>

          {runs.length > 1 && (
            <div className="flex flex-col gap-1.5 border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">Histórico recente</span>
              {runs.slice(1).map((run) => (
                <div key={run.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{formatDateTime(run.startedAt)}</span>
                  <Badge variant={STATUS_VARIANT[run.status]} className="h-4 px-1.5">
                    {STATUS_LABEL[run.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
