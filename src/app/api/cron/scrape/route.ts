import { NextResponse } from "next/server";
import { runScrape, ScrapeAlreadyRunningError } from "@/lib/scraper/run";
import { expire, TAGS } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/// Comparação em tempo constante — mesmo padrão de src/lib/auth.ts.
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

function isAuthorized(request: Request, secret: string): boolean {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (bearer && timingSafeEqual(bearer, secret)) return true;

  const altHeader = request.headers.get("x-cron-secret") ?? "";
  if (altHeader && timingSafeEqual(altHeader, secret)) return true;

  return false;
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  // Sem CRON_SECRET configurado a rota nunca fica aberta: 503 em vez de
  // aceitar chamadas sem autenticação.
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  if (!isAuthorized(request, secret)) {
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
