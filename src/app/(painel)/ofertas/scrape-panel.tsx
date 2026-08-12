"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress, ProgressLabel, ProgressTrack, ProgressIndicator, ProgressValue } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ScrapeState {
  status: "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL";
  percent: number;
  watchesDone: number;
  watchesTotal: number;
  itemsSeen: number;
  productsNew: number;
  offersNew: number;
  log: string[];
  running: boolean;
  error: string | null;
}

const INITIAL_STATE: ScrapeState = {
  status: "RUNNING",
  percent: 0,
  watchesDone: 0,
  watchesTotal: 0,
  itemsSeen: 0,
  productsNew: 0,
  offersNew: 0,
  log: [],
  running: true,
  error: null,
};

/// Botão "Buscar ofertas" do PageHeader — dispara POST /api/scrape e abre um
/// painel de progresso ao vivo lendo o SSE de /api/scrape/stream. Em caso de
/// 409 (já rodando), reconecta no runId em andamento em vez de dar erro.
export function ScrapePanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [state, setState] = useState<ScrapeState>(INITIAL_STATE);
  const sourceRef = useRef<EventSource | null>(null);

  const closeStream = () => {
    sourceRef.current?.close();
    sourceRef.current = null;
  };

  const connect = (runId?: string | null) => {
    closeStream();
    setState(INITIAL_STATE);
    setOpen(true);

    const url = runId ? `/api/scrape/stream?runId=${encodeURIComponent(runId)}` : "/api/scrape/stream";
    const source = new EventSource(url);
    sourceRef.current = source;

    source.addEventListener("progress", (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setState((prev) => ({ ...prev, ...data }));
    });

    source.addEventListener("done", (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setState((prev) => ({ ...prev, ...data, running: false }));
      closeStream();
      if (data.status === "FAILED") {
        toast.error("Varredura falhou", { description: data.error ?? undefined });
      } else {
        toast.success(`Varredura concluída: ${data.offersNew} oferta(s) nova(s)`);
      }
      router.refresh();
    });

    source.addEventListener("error", () => {
      // Se o stream cair no meio (rede, proxy), não temos como saber o
      // desfecho — melhor deixar o usuário reabrir do que inventar um status.
      closeStream();
      setState((prev) => (prev.running ? { ...prev, running: false } : prev));
    });
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      if (res.status === 202) {
        connect(null);
      } else if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        toast.info("Já existe uma varredura em andamento, acompanhando.");
        connect(data.runId ?? null);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Não foi possível iniciar a varredura");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível iniciar a varredura");
    } finally {
      setStarting(false);
    }
  };

  return (
    <>
      <Button onClick={handleStart} disabled={starting}>
        {starting ? (
          <HugeiconsIcon icon={Loading03Icon} size={14} strokeWidth={1.5} className="animate-spin" />
        ) : (
          <HugeiconsIcon icon={RefreshIcon} size={14} strokeWidth={1.5} />
        )}
        Buscar ofertas
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeStream();
          setOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Varredura de ofertas</DialogTitle>
            <DialogDescription>
              {state.running ? "Em andamento..." : state.status === "FAILED" ? "Falhou." : "Concluída."}
            </DialogDescription>
          </DialogHeader>

          <Progress value={state.percent}>
            <div className="flex justify-between">
              <ProgressLabel>
                Watches: {state.watchesDone}/{state.watchesTotal}
              </ProgressLabel>
              <ProgressValue />
            </div>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>

          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-muted p-2">
              <div className="text-lg font-semibold text-foreground">{state.itemsSeen}</div>
              <div className="text-xs text-muted-foreground">Itens vistos</div>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <div className="text-lg font-semibold text-foreground">{state.productsNew}</div>
              <div className="text-xs text-muted-foreground">Produtos novos</div>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <div className="text-lg font-semibold text-foreground">{state.offersNew}</div>
              <div className="text-xs text-muted-foreground">Ofertas novas</div>
            </div>
          </div>

          <ScrollArea className="h-40 rounded-lg border border-border bg-muted/40 p-2">
            <div className="flex flex-col gap-0.5 font-mono text-xs text-muted-foreground">
              {state.log.length === 0 ? (
                <span>Aguardando log...</span>
              ) : (
                state.log.map((line, i) => <span key={i}>{line}</span>)
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                closeStream();
                setOpen(false);
              }}
              className={cn(state.running && "opacity-70")}
            >
              {state.running ? "Continuar em segundo plano" : "Fechar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
