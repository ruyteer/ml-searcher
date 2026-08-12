import { NextResponse, after } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getLatestRun, runScrape, ScrapeAlreadyRunningError } from "@/lib/scraper/run";
import { expire, TAGS } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/// Espelha STALE_RUN_MS de scraper/run.ts (não exportado de lá). Usado só
/// para não bloquear novos disparos com um run RUNNING órfão — o próprio
/// runScrape faz a limpeza definitiva quando chamado.
const STALE_RUN_MS = 30 * 60 * 1000;

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Checagem rápida para devolver 409 com o runId em andamento, permitindo o
  // painel reconectar em vez de abrir uma segunda varredura. Ainda existe uma
  // janela mínima entre esta leitura e a criação do run dentro de runScrape —
  // a mesma tolerância que o próprio runScrape já assume (seu findActiveRun
  // não usa lock); não estamos introduzindo uma corrida nova.
  const current = await getLatestRun();
  if (current?.running && Date.now() - new Date(current.startedAt).getTime() <= STALE_RUN_MS) {
    return NextResponse.json(
      { error: "Já existe uma varredura em andamento", runId: current.id },
      { status: 409 },
    );
  }

  // runScrape só resolve quando a varredura inteira termina (pode levar
  // minutos). Roda dentro de after() para a resposta HTTP não ficar presa
  // esperando; maxDuration mantém o processo vivo até o after() concluir.
  //
  // Não dá para devolver o runId criado nesta chamada: o registro só existe
  // depois de alguns awaits internos ao runScrape (settings, watches...), e
  // consultar getLatestRun() aqui fora, antes do after() rodar, devolveria a
  // varredura ANTERIOR — dado errado é pior que dado ausente. Por isso a
  // resposta só confirma o início; o painel descobre o run corrente via
  // GET /api/scrape/status (sem runId ele usa getLatestRun()).
  after(async () => {
    try {
      await runScrape({ trigger: "manual" });
    } catch (err) {
      // Corrida rara com outra chamada concorrente: já foi tratada por ela.
      if (!(err instanceof ScrapeAlreadyRunningError)) {
        console.error("[scrape] falha na varredura em background:", err);
      }
    } finally {
      expire(TAGS.products, TAGS.offers, TAGS.runs);
    }
  });

  return NextResponse.json({ started: true }, { status: 202 });
}
