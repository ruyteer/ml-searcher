import { getLatestRun, getRunProgress } from "@/lib/scraper/run";
import { toStatusPayload } from "../_lib";

export const dynamic = "force-dynamic";

/// Intervalo de polling do progresso no banco.
const POLL_MS = 1000;
/// Comentário keep-alive para proxies não derrubarem a conexão por inatividade.
const PING_MS = 15000;

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/// Progresso ao vivo via SSE. ?runId=... opcional, mesma regra do /status.
/// Emite "progress" a cada 1s enquanto RUNNING, um "done" final quando o run
/// sai de RUNNING (ou "error" se o run não existir) e então fecha o stream.
export async function GET(request: Request) {
  const runId = new URL(request.url).searchParams.get("runId");
  const encoder = new TextEncoder();

  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // Fecha tudo uma única vez — limpar os dois intervalos é o que evita
      // vazar timers (e derrubar o servidor) quando o cliente desconecta.
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearInterval(pollTimer);
        if (pingTimer) clearInterval(pingTimer);
        try {
          controller.close();
        } catch {
          // stream já fechado do outro lado, ignora
        }
      };

      if (request.signal.aborted) {
        cleanup();
        return;
      }
      request.signal.addEventListener("abort", cleanup, { once: true });

      /// Busca o progresso atual e emite. Devolve false quando o stream deve encerrar.
      const tick = async (): Promise<boolean> => {
        const progress = runId ? await getRunProgress(runId) : await getLatestRun();
        if (closed) return false;

        if (!progress) {
          controller.enqueue(encoder.encode(sseEvent("error", { error: "Nenhuma varredura encontrada" })));
          return false;
        }

        const payload = toStatusPayload(progress);
        controller.enqueue(encoder.encode(sseEvent(progress.running ? "progress" : "done", payload)));
        return progress.running;
      };

      (async () => {
        try {
          const stillRunning = await tick();
          if (!stillRunning) {
            cleanup();
            return;
          }
        } catch {
          cleanup();
          return;
        }

        pollTimer = setInterval(async () => {
          if (closed) return;
          try {
            const stillRunning = await tick();
            if (!stillRunning) cleanup();
          } catch {
            cleanup();
          }
        }, POLL_MS);

        pingTimer = setInterval(() => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            cleanup();
          }
        }, PING_MS);
      })();
    },
    cancel() {
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (pingTimer) clearInterval(pingTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
