import { NextResponse, after } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runScrape, startScrapeRun, ScrapeAlreadyRunningError } from "@/lib/scraper/run";
import { expire, TAGS } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // A linha do ScrapeRun nasce AQUI, antes de qualquer trabalho pesado, e o
  // id volta na resposta. Antes a varredura inteira rodava dentro do after() e
  // a resposta só dizia "começou": o painel então perguntava qual era "a
  // execução mais recente" e recebia a ANTERIOR, já concluída, o que fazia a
  // barra de progresso pular para 100% antes de sair do lugar.
  let runId: string;
  try {
    ({ runId } = await startScrapeRun("manual"));
  } catch (err) {
    if (err instanceof ScrapeAlreadyRunningError) {
      return NextResponse.json(
        { error: "Já existe uma varredura em andamento", runId: err.runId },
        { status: 409 },
      );
    }
    console.error("[scrape] falha ao iniciar a varredura:", err);
    return NextResponse.json({ error: "Não foi possível iniciar a varredura" }, { status: 500 });
  }

  // runScrape só resolve quando a varredura inteira termina (pode levar
  // minutos). Roda dentro de after() para a resposta HTTP não ficar presa
  // esperando; maxDuration mantém o processo vivo até o after() concluir.
  after(async () => {
    try {
      await runScrape({ trigger: "manual", runId });
    } catch (err) {
      console.error("[scrape] falha na varredura em background:", err);
      // Rede de segurança: se runScrape explodiu antes de gravar o desfecho,
      // a linha ficaria em RUNNING e travaria os próximos disparos até
      // expirar por tempo. Marcamos aqui para o painel saber na hora.
      await prisma.scrapeRun
        .updateMany({
          where: { id: runId, status: "RUNNING" },
          data: {
            status: "FAILED",
            error: err instanceof Error ? err.message : String(err),
            finishedAt: new Date(),
          },
        })
        .catch(() => {});
    } finally {
      expire(TAGS.products, TAGS.offers, TAGS.runs);
    }
  });

  return NextResponse.json({ started: true, runId }, { status: 202 });
}
