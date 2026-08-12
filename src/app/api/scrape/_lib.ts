/// Helpers compartilhados entre /api/scrape/status e /api/scrape/stream.
/// Não é uma rota (arquivo não se chama route.ts), só um módulo comum.
import type { RunProgress } from "@/lib/scraper/run";

/// Quantas linhas de log recentes o cliente recebe por chamada.
export const LOG_TAIL = 50;

export interface ScrapeStatusPayload {
  id: string;
  status: RunProgress["status"];
  trigger: string;
  watchesTotal: number;
  watchesDone: number;
  itemsSeen: number;
  productsNew: number;
  offersNew: number;
  error: string | null;
  log: string[];
  startedAt: string;
  finishedAt: string | null;
  running: boolean;
  percent: number;
  durationMs: number;
}

export function toStatusPayload(progress: RunProgress): ScrapeStatusPayload {
  return {
    id: progress.id,
    status: progress.status,
    trigger: progress.trigger,
    watchesTotal: progress.watchesTotal,
    watchesDone: progress.watchesDone,
    itemsSeen: progress.itemsSeen,
    productsNew: progress.productsNew,
    offersNew: progress.offersNew,
    error: progress.error,
    log: progress.log.slice(-LOG_TAIL),
    startedAt: progress.startedAt.toISOString(),
    finishedAt: progress.finishedAt ? progress.finishedAt.toISOString() : null,
    running: progress.running,
    percent: progress.percent,
    durationMs: progress.durationMs,
  };
}
