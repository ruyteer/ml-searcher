"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  IconAtualizar,
  IconCarregando,
  IconVarredura,
  IconSucesso,
  IconAlerta,
  IconErro,
  IconOfertas,
} from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  currentCategory,
  explainFailure,
  humanizeLogLine,
  plural,
  remainingEstimate,
  type ScrapeStatusPayload,
} from "./scrape-progress";

/// Fases do painel. "disparando" é o intervalo entre o clique e o momento em
/// que sabemos QUAL execução é a nossa; "varrendo" é o acompanhamento real.
type Phase = "idle" | "disparando" | "varrendo" | "encerrada" | "sem-resposta";

/// Ritmo do polling que descobre o id da execução recém-disparada.
const DISCOVERY_POLL_MS = 700;
/// Depois disso desistimos de descobrir o id e avisamos o usuário, em vez de
/// deixar o painel girando para sempre.
const DISCOVERY_TIMEOUT_MS = 45_000;
/// Espelha o limite do servidor (STALE_RUN_MS em lib/scraper/run.ts): passado
/// isso, uma execução ainda marcada como em andamento é órfã, não está viva.
const STALE_RUN_MS = 30 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchStatus(runId?: string | null): Promise<ScrapeStatusPayload | null> {
  const url = runId ? `/api/scrape/status?runId=${encodeURIComponent(runId)}` : "/api/scrape/status";
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ScrapeStatusPayload;
  } catch {
    return null;
  }
}

/// Botão "Buscar ofertas" do cabeçalho de /ofertas mais o painel de progresso
/// ao vivo.
///
/// POR QUE O PROGRESSO PULAVA PARA 100% E VOLTAVA A ZERO:
/// o POST /api/scrape responde 202 sem o id da execução (o registro só nasce
/// alguns awaits depois, já dentro do after()). O painel então abria o stream
/// SEM runId, e nessa janela o servidor devolve a execução mais recente, que
/// ainda é a ANTERIOR, concluída em 100%. A barra mostrava 100%, o stream
/// fechava com "done", e só depois o painel via a execução nova começando do
/// zero.
///
/// Correção: nunca acompanhamos "a mais recente". Antes de disparar, anotamos
/// qual é a execução mais recente hoje; depois do 202, ficamos consultando
/// /api/scrape/status até aparecer uma execução com id DIFERENTE daquela, e só
/// então abrimos o stream fixado nesse runId. Enquanto isso a tela mostra
/// "disparando", sem barra de porcentagem: dado ausente é melhor que dado
/// errado. Todo evento recebido com id diferente do aceito é descartado.
export function ScrapePanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState<ScrapeStatusPayload | null>(null);

  const sourceRef = useRef<EventSource | null>(null);
  const runIdRef = useRef<string | null>(null);
  /// Cada clique em "Buscar ofertas" incrementa isto. O laço de descoberta
  /// compara antes de cada passo e desiste se ficou obsoleto (usuário fechou o
  /// painel ou disparou de novo).
  const attemptRef = useRef(0);

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  useEffect(() => closeStream, [closeStream]);

  /// Abre o stream fixado num runId conhecido. Sem runId não abrimos nada.
  const connect = useCallback(
    (runId: string) => {
      closeStream();
      runIdRef.current = runId;
      setPhase("varrendo");

      const source = new EventSource(`/api/scrape/stream?runId=${encodeURIComponent(runId)}`);
      sourceRef.current = source;

      const apply = (event: Event, finished: boolean) => {
        let data: ScrapeStatusPayload;
        try {
          data = JSON.parse((event as MessageEvent).data) as ScrapeStatusPayload;
        } catch {
          return;
        }
        // Barreira final: só aceitamos o que for da execução que disparamos.
        if (data.id !== runIdRef.current) return;
        setRun(data);
        if (finished) setPhase("encerrada");
      };

      source.addEventListener("progress", (event) => apply(event, false));

      source.addEventListener("done", (event) => {
        apply(event, true);
        closeStream();
        let data: ScrapeStatusPayload | null = null;
        try {
          data = JSON.parse((event as MessageEvent).data) as ScrapeStatusPayload;
        } catch {
          data = null;
        }
        if (data && data.id === runIdRef.current) {
          if (data.status === "FAILED") {
            toast.error("A varredura não conseguiu terminar");
          } else {
            toast.success(
              data.offersNew > 0
                ? `Varredura concluída: ${plural(data.offersNew, "oferta nova", "ofertas novas")}`
                : "Varredura concluída, nenhuma oferta nova desta vez",
            );
          }
        }
        router.refresh();
      });

      source.addEventListener("error", () => {
        // O stream caiu (rede, proxy, aba em segundo plano). Não inventamos
        // desfecho: uma consulta direta ao status diz como a execução terminou.
        closeStream();
        void (async () => {
          const latest = await fetchStatus(runId);
          if (!latest || latest.id !== runIdRef.current) return;
          setRun(latest);
          if (!latest.running) setPhase("encerrada");
        })();
      });
    },
    [closeStream, router],
  );

  /// Espera nascer uma execução diferente da que já existia antes do disparo.
  const discoverRun = useCallback(
    async (previousId: string | null, attempt: number) => {
      const deadline = Date.now() + DISCOVERY_TIMEOUT_MS;

      while (Date.now() < deadline) {
        if (attemptRef.current !== attempt) return;
        const latest = await fetchStatus();
        if (attemptRef.current !== attempt) return;

        // id diferente do de antes do disparo = é a nossa execução. Comparar
        // ids (e não horários) evita depender do relógio do navegador bater
        // com o do servidor.
        if (latest && latest.id !== previousId) {
          setRun(latest);
          connect(latest.id);
          return;
        }
        await sleep(DISCOVERY_POLL_MS);
      }

      if (attemptRef.current !== attempt) return;
      setPhase("sem-resposta");
    },
    [connect],
  );

  const handleStart = useCallback(async () => {
    // Já existe uma execução acompanhada e viva: reabrir apenas reconecta.
    if (run?.running && runIdRef.current) {
      setOpen(true);
      connect(runIdRef.current);
      return;
    }

    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    closeStream();
    runIdRef.current = null;
    setRun(null);
    setPhase("disparando");
    setOpen(true);

    // Foto do "antes": qual execução era a mais recente até este clique.
    const previous = await fetchStatus();
    if (attemptRef.current !== attempt) return;
    const previousId = previous?.id ?? null;

    // Uma execução ainda viva na foto do antes já é a que interessa: em vez de
    // abrir outra, acompanhamos essa. "Viva" exclui a execução órfã (processo
    // morto no meio), que o servidor só desmarca depois de meia hora e que
    // deixaria o painel esperando para sempre por um progresso que não vem.
    if (previous?.running && previous.durationMs < STALE_RUN_MS) {
      setRun(previous);
      connect(previous.id);
      return;
    }

    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      if (attemptRef.current !== attempt) return;

      if (res.status === 202) {
        await discoverRun(previousId, attempt);
        return;
      }

      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as { runId?: string };
        if (data.runId) {
          const current = await fetchStatus(data.runId);
          if (attemptRef.current !== attempt) return;
          if (current) setRun(current);
          connect(data.runId);
        } else {
          await discoverRun(previousId, attempt);
        }
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setPhase("sem-resposta");
      toast.error(data.error ?? "Não foi possível iniciar a varredura");
    } catch (err) {
      if (attemptRef.current !== attempt) return;
      setPhase("sem-resposta");
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar a varredura");
    }
  }, [closeStream, connect, discoverRun, run]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      closeStream();
      // Fechar durante a fase de descoberta cancela o laço; se já estamos
      // acompanhando um runId, ele fica guardado para reabrir depois.
      if (phase === "disparando" || phase === "sem-resposta") attemptRef.current += 1;
    }
    setOpen(next);
  };

  const running = phase === "disparando" || phase === "varrendo";
  const log = useMemo(() => (run?.log ?? []).map(humanizeLogLine), [run?.log]);
  const categoria = useMemo(() => currentCategory(run?.log ?? []), [run?.log]);
  const estimate = run
    ? remainingEstimate({
        watchesDone: run.watchesDone,
        watchesTotal: run.watchesTotal,
        durationMs: run.durationMs,
        running: phase === "varrendo",
      })
    : null;
  const failure = run && phase === "encerrada" ? explainFailure(run.status, run.error) : null;
  const faltam = run ? Math.max(0, run.watchesTotal - run.watchesDone) : 0;

  const headline =
    phase === "disparando"
      ? "Disparando a varredura"
      : phase === "sem-resposta"
        ? "A varredura não respondeu"
        : phase === "encerrada"
          ? run?.status === "FAILED"
            ? "Varredura sem resultado"
            : run?.status === "PARTIAL"
              ? "Varredura concluída em parte"
              : "Varredura concluída"
          : "Varrendo as categorias";

  const subtitle =
    phase === "disparando"
      ? "Preparando a lista de categorias monitoradas. Isso leva alguns segundos."
      : phase === "sem-resposta"
        ? "O painel pediu a varredura, mas ela não começou a dar sinal. Tente de novo em instantes."
        : phase === "encerrada"
          ? "Veja o que entrou de novo no painel."
          : categoria
            ? `Olhando agora: ${categoria}`
            : "Buscando os produtos da primeira categoria.";

  return (
    <>
      <Button
        onClick={handleStart}
        disabled={phase === "disparando"}
        className="h-11 w-full sm:h-8 sm:w-auto"
      >
        <HugeiconsIcon
          icon={running ? IconCarregando : IconAtualizar}
          size={16}
          strokeWidth={1.5}
          className={cn(running && "animate-spin")}
        />
        {phase === "varrendo" && !open ? "Ver varredura em andamento" : "Buscar ofertas"}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        {/* No celular o painel ocupa quase a tela toda e rola por dentro, para
            o log nunca ficar cortado fora da área visível. */}
        <DialogContent className="grid max-h-[90svh] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden sm:max-w-lg">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2">
              <HugeiconsIcon
                icon={
                  phase === "sem-resposta"
                    ? IconErro
                    : phase === "encerrada"
                      ? run?.status === "SUCCESS"
                        ? IconSucesso
                        : IconAlerta
                      : IconVarredura
                }
                size={18}
                strokeWidth={1.6}
                className={cn(
                  phase === "encerrada" && run?.status === "SUCCESS" && "text-success",
                  (phase === "sem-resposta" || (phase === "encerrada" && run?.status === "FAILED")) &&
                    "text-danger",
                )}
                aria-hidden="true"
              />
              {headline}
            </DialogTitle>
            <DialogDescription>{subtitle}</DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
            {phase === "disparando" && (
              // Sem porcentagem de propósito: até saber qual execução é a
              // nossa, qualquer número seria chute (era exatamente daí que
              // vinha o salto para 100%).
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
              </div>
            )}

            {phase === "varrendo" && run && run.watchesTotal > 0 && (
              <div className="flex flex-col gap-1.5">
                <Progress value={run.percent}>
                  <div className="flex w-full items-baseline justify-between gap-2">
                    <ProgressLabel className="text-sm font-medium">
                      Categoria {Math.min(run.watchesDone + 1, run.watchesTotal)} de {run.watchesTotal}
                    </ProgressLabel>
                    <ProgressValue />
                  </div>
                </Progress>
                <p className="text-xs text-muted-foreground">
                  {faltam === 0
                    ? "Fechando a última categoria."
                    : plural(faltam, "categoria ainda por varrer", "categorias ainda por varrer")}
                  {estimate ? `, ${estimate}.` : ". Ainda calculando o tempo restante."}
                </p>
              </div>
            )}

            {phase === "varrendo" && run && run.watchesTotal === 0 && (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                Nenhuma categoria monitorada está ligada, então não há o que varrer. Ligue pelo menos uma em
                Configurações.
              </p>
            )}

            {phase === "encerrada" && run && (
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-2xl leading-none font-semibold text-foreground tabular-nums">
                    {run.offersNew.toLocaleString("pt-BR")}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {run.offersNew === 1 ? "oferta nova" : "ofertas novas"}
                  </div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-2xl leading-none font-semibold text-foreground tabular-nums">
                    {run.productsNew.toLocaleString("pt-BR")}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {run.productsNew === 1 ? "produto novo" : "produtos novos"}
                  </div>
                </div>
              </div>
            )}

            {phase === "varrendo" && run && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted p-2">
                  <div className="text-base font-semibold text-foreground tabular-nums">
                    {run.itemsSeen.toLocaleString("pt-BR")}
                  </div>
                  <div className="text-xs text-muted-foreground">produtos olhados</div>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <div className="text-base font-semibold text-foreground tabular-nums">
                    {run.productsNew.toLocaleString("pt-BR")}
                  </div>
                  <div className="text-xs text-muted-foreground">produtos novos</div>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <div className="text-base font-semibold text-foreground tabular-nums">
                    {run.offersNew.toLocaleString("pt-BR")}
                  </div>
                  <div className="text-xs text-muted-foreground">ofertas novas</div>
                </div>
              </div>
            )}

            {failure && (
              <div className="flex flex-col gap-1 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs">
                <span className="font-medium text-foreground">{failure.headline}</span>
                {failure.items.map((item, i) => (
                  <span key={i} className="text-muted-foreground">
                    {item}
                  </span>
                ))}
              </div>
            )}

            {phase !== "sem-resposta" && (
              <div className="flex min-h-0 flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">O que aconteceu</span>
                {/* Altura menor no celular: o log continua rolável e o rodapé
                    com os botões não sai da tela. */}
                <div className="h-32 overflow-y-auto overscroll-contain rounded-lg border border-border bg-muted/40 p-2 sm:h-40">
                  <div className="flex flex-col gap-1 text-xs leading-snug text-muted-foreground">
                    {log.length === 0 ? (
                      <span>Ainda não há nada para contar.</span>
                    ) : (
                      log.map((line, i) => (
                        <span key={i} className="break-words">
                          {line}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {phase === "encerrada" && (run?.offersNew ?? 0) > 0 && (
              <Button
                className="h-11 w-full sm:h-8 sm:w-auto"
                onClick={() => {
                  setOpen(false);
                  router.push("/ofertas?sort=recent");
                  router.refresh();
                }}
              >
                <HugeiconsIcon icon={IconOfertas} size={16} strokeWidth={1.5} />
                Ver as ofertas novas
              </Button>
            )}
            {phase === "sem-resposta" && (
              <Button className="h-11 w-full sm:h-8 sm:w-auto" onClick={handleStart}>
                <HugeiconsIcon icon={IconAtualizar} size={16} strokeWidth={1.5} />
                Tentar de novo
              </Button>
            )}
            <Button
              variant="outline"
              className="h-11 w-full sm:h-8 sm:w-auto"
              onClick={() => handleOpenChange(false)}
            >
              {running ? "Deixar rodando e fechar" : "Fechar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
