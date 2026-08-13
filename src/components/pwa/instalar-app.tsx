"use client";

import { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { IconBaixar, IconCompartilhar, IconFechar } from "@/components/icons";

const CHAVE_DISPENSADO = "mls_instalar_dispensado";

/// Evento do Chrome, ainda fora dos tipos padrão do TypeScript.
interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/// Já está aberto como app instalado (fora do navegador)?
function estaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // Safari no iOS usa uma propriedade própria, fora do padrão.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/// iPhone e iPad. O iPad moderno se apresenta como Mac, então o número de
/// pontos de toque é o que separa um do outro.
function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Convite discreto para deixar o painel na tela de início do celular.
 *
 * No Android e no Chrome existe um evento próprio de instalação, então o
 * botão faz tudo sozinho. No iOS esse evento não existe, e a única forma é
 * pelo menu de compartilhar do Safari, então ali mostramos a instrução.
 *
 * Uma vez dispensado, não volta.
 */
export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalacao | null>(null);
  const [mostrarIOS, setMostrarIOS] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (estaInstalado()) return;
    if (window.localStorage.getItem(CHAVE_DISPENSADO) === "1") return;

    function aoPoderInstalar(e: Event) {
      // Sem isso o Chrome mostra a barra dele, que atrapalha a tela.
      e.preventDefault();
      setEvento(e as EventoInstalacao);
      setVisivel(true);
    }

    function aoInstalar() {
      setVisivel(false);
      window.localStorage.setItem(CHAVE_DISPENSADO, "1");
    }

    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    window.addEventListener("appinstalled", aoInstalar);

    // No iOS não existe evento nenhum: mostramos a instrução manual, mas
    // só depois de um respiro, para não pular na cara de quem acabou de
    // abrir o painel.
    let tempo: ReturnType<typeof setTimeout> | undefined;
    if (ehIOS()) {
      tempo = setTimeout(() => {
        setMostrarIOS(true);
        setVisivel(true);
      }, 4000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
      window.removeEventListener("appinstalled", aoInstalar);
      if (tempo) clearTimeout(tempo);
    };
  }, []);

  const dispensar = useCallback(() => {
    setVisivel(false);
    window.localStorage.setItem(CHAVE_DISPENSADO, "1");
  }, []);

  const instalar = useCallback(async () => {
    if (!evento) return;
    setVisivel(false);
    await evento.prompt();
    await evento.userChoice;
    setEvento(null);
    window.localStorage.setItem(CHAVE_DISPENSADO, "1");
  }, [evento]);

  if (!visivel) return null;

  return (
    <div
      // Acima da barra de navegação no celular; canto inferior no desktop.
      className="fixed inset-x-3 bottom-[calc(4.25rem+var(--area-segura-baixo))] z-50 rounded-xl border border-border bg-popover p-3 shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:w-80"
      role="dialog"
      aria-label="Instalar o painel no celular"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <HugeiconsIcon
            icon={mostrarIOS ? IconCompartilhar : IconBaixar}
            size={18}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-heading text-sm font-semibold text-foreground">
            {mostrarIOS ? "Deixe o painel na tela de início" : "Instalar no celular"}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {mostrarIOS
              ? "Toque em compartilhar, aqui embaixo no Safari, e escolha Adicionar à Tela de Início."
              : "Abre direto, em tela cheia, sem passar pelo navegador."}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {!mostrarIOS && (
              <Button size="sm" onClick={instalar} className="min-h-11 flex-1 md:min-h-0">
                Instalar
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={dispensar}
              className="min-h-11 flex-1 text-muted-foreground md:min-h-0"
            >
              {mostrarIOS ? "Entendi" : "Agora não"}
            </Button>
          </div>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={dispensar}
          aria-label="Dispensar"
          className="shrink-0 text-muted-foreground"
        >
          <HugeiconsIcon icon={IconFechar} size={15} strokeWidth={1.8} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
