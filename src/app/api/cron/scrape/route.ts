import { NextResponse } from "next/server";
import { runScrape, ScrapeAlreadyRunningError } from "@/lib/scraper/run";
import { getSettings, setSettings } from "@/lib/settings";
import { expire, TAGS } from "@/lib/cache";
import { cronSecretConfigured, isAuthorizedCron } from "@/lib/cron-auth";
import { withAdvisoryLock } from "@/lib/db/advisory-lock";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/// Teto de tolerância a tick adiantado, latência e skew de relógio entre o
/// agendador externo e a app — sem isso, milissegundos de diferença custam
/// uma janela inteira do agendamento. Proporcional ao intervalo configurado
/// (10%) para não engolir uma fatia grande demais de intervalos curtos.
const TICK_TOLERANCE_MS = 60_000;

function tickToleranceFor(intervalMs: number): number {
  return Math.min(TICK_TOLERANCE_MS, Math.floor(intervalMs / 10));
}

/// Chave arbitrária do lock consultivo do Postgres — diferente das usadas em
/// src/lib/whatsapp/send.ts (552_013_487) e src/lib/ml/affiliate-check-cycle.ts
/// (918_273_645), para não colidir com aqueles ciclos.
const ADVISORY_LOCK_KEY = 734_912_058;

interface Schedule {
  now: number;
  intervalMinutes: number;
  nextRunAt: string | null;
  dueInMs: number;
  tickToleranceMs: number;
}

function buildSchedule(
  now: number,
  intervalMinutes: number,
  dueAt: number,
  tickToleranceMs: number,
): Schedule {
  return {
    now,
    intervalMinutes,
    nextRunAt: Number.isFinite(dueAt) ? new Date(dueAt).toISOString() : null,
    dueInMs: Number.isFinite(dueAt) ? dueAt - now : 0,
    tickToleranceMs,
  };
}

async function handle(request: Request): Promise<Response> {
  // Sem CRON_SECRET configurado a rota nunca fica aberta: 503 em vez de
  // aceitar chamadas sem autenticação.
  if (!cronSecretConfigured()) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const settings = await getSettings();
  const intervalMs = Math.max(1, settings.scrapeIntervalMinutes) * 60_000;
  const dueAt = settings.scrapeNextRunAt ? Date.parse(settings.scrapeNextRunAt) : NaN;
  const now = Date.now();
  const tickToleranceMs = tickToleranceFor(intervalMs);

  // Intervalo reduzido no painel não pode deixar o usuário preso esperando a
  // âncora antiga vencer (ela pode ter sido calculada com um intervalo bem
  // maior). Comparar contra now+intervalMs a cada tick não funciona: os dois
  // lados avançam juntos e o gate nunca fecha antes da âncora original vencer
  // de verdade. Em vez disso, decide uma vez por ciclo se a âncora estourou o
  // orçamento do intervalo atual — se estourou, trata como devida agora.
  const overBudget = Number.isFinite(dueAt) && dueAt - now > intervalMs;
  const effectiveDueAt = overBudget ? now : dueAt;

  if (Number.isFinite(effectiveDueAt) && now + tickToleranceMs < effectiveDueAt) {
    return NextResponse.json({
      started: false,
      skipped: { code: "not_due", reason: "ainda não é hora da próxima varredura" },
      schedule: buildSchedule(now, settings.scrapeIntervalMinutes, effectiveDueAt, tickToleranceMs),
    });
  }

  return withAdvisoryLock<Response>(
    ADVISORY_LOCK_KEY,
    async () =>
      NextResponse.json(
        {
          started: false,
          skipped: { code: "already_running", reason: "outra varredura já está rodando" },
          schedule: buildSchedule(now, settings.scrapeIntervalMinutes, effectiveDueAt, tickToleranceMs),
        },
        { status: 409 },
      ),
    async () => {
      // Avança a âncora NA GRADE do agendamento antes do trabalho — não
      // depois: senão uma varredura lenta ou que falha deixa o gate aberto em
      // todo tick seguinte até queimar o intervalo configurado.
      let next = (Number.isFinite(effectiveDueAt) ? effectiveDueAt : now) + intervalMs;
      if (next <= now) next = now + intervalMs;
      await setSettings({ scrapeNextRunAt: new Date(next).toISOString() });
      expire(TAGS.settings);

      const schedule = buildSchedule(now, settings.scrapeIntervalMinutes, next, tickToleranceMs);

      try {
        const result = await runScrape({ trigger: "cron" });
        expire(TAGS.products, TAGS.offers, TAGS.runs);
        return NextResponse.json({ ...result, schedule });
      } catch (err) {
        if (err instanceof ScrapeAlreadyRunningError) {
          // Já rodando: não é erro, o cron seguinte tenta de novo.
          return NextResponse.json(
            { started: false, runId: err.runId, error: "Já existe uma varredura em andamento", schedule },
            { status: 409 },
          );
        }
        console.error("[cron/scrape] falha na varredura:", err);
        return NextResponse.json({ error: "Falha na varredura", schedule }, { status: 500 });
      }
    },
  );
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
