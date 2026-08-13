import { NextResponse } from "next/server";
import { runScrape, ScrapeAlreadyRunningError } from "@/lib/scraper/run";
import { expire, TAGS } from "@/lib/cache";
import { cronSecretConfigured, isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(request: Request): Promise<Response> {
  // Sem CRON_SECRET configurado a rota nunca fica aberta: 503 em vez de
  // aceitar chamadas sem autenticação.
  if (!cronSecretConfigured()) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await runScrape({ trigger: "cron" });
    expire(TAGS.products, TAGS.offers, TAGS.runs);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ScrapeAlreadyRunningError) {
      // Já rodando: não é erro, o cron seguinte tenta de novo.
      return NextResponse.json(
        { started: false, runId: err.runId, error: "Já existe uma varredura em andamento" },
        { status: 409 },
      );
    }
    console.error("[cron/scrape] falha na varredura:", err);
    return NextResponse.json({ error: "Falha na varredura" }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
