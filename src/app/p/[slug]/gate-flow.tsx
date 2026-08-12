"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface GateFlowProps {
  gateUrl: string;
  gateLabel: string;
  /// Segundos de espera antes de liberar o botão final.
  gateDelay: number;
  ctaText: string;
  ctaHref: string;
}

/// Único pedaço interativo da pre-sell: o visitante abre o link do
/// patrocinador em nova aba, espera a contagem regressiva, e só então o
/// botão final (que conta o clique) fica liberado.
export function GateFlow({ gateUrl, gateLabel, gateDelay, ctaText, ctaHref }: GateFlowProps) {
  const [started, setStarted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.max(0, gateDelay));

  useEffect(() => {
    if (!started || gateDelay <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [started, gateDelay]);

  const ready = started && secondsLeft <= 0;

  return (
    <div className="flex flex-col gap-3">
      <a
        href={gateUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setStarted(true)}
        aria-disabled={started}
        className={cn(
          buttonVariants({ variant: started ? "outline" : "default" }),
          "h-12 w-full text-base font-semibold",
          started && "pointer-events-none opacity-70",
        )}
      >
        {started ? "Passo 1 concluído" : gateLabel}
      </a>

      {started && !ready && (
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          Liberando o botão em {secondsLeft}s...
        </p>
      )}

      {ready ? (
        <a
          href={ctaHref}
          className={cn(buttonVariants(), "h-12 w-full text-base font-semibold")}
        >
          {ctaText}
        </a>
      ) : (
        <span
          aria-disabled="true"
          className={cn(
            buttonVariants(),
            "h-12 w-full cursor-not-allowed text-base font-semibold opacity-50",
          )}
        >
          {ctaText}
        </span>
      )}
    </div>
  );
}
