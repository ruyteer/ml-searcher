"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Liga o app instalado ao arquivo public/sw.js.
 *
 * Duas responsabilidades: registrar, e não deixar o celular preso numa
 * versão antiga. Quando aparece uma versão nova, ela fica em espera e o
 * usuário recebe um aviso com o botão de atualizar. A troca só acontece
 * quando ele toca, para não recarregar a tela no meio de uma cópia de link.
 *
 * Só roda em produção: em desenvolvimento ele atrapalharia a recarga rápida.
 */
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let cancelado = false;
    let recarregando = false;

    // A troca de versão só recarrega uma vez, nunca em laço.
    function aoTrocarVersao() {
      if (recarregando) return;
      recarregando = true;
      window.location.reload();
    }

    function avisarVersaoNova(emEspera: ServiceWorker) {
      if (cancelado) return;
      toast("Tem uma versão nova do painel", {
        id: "versao-nova",
        description: "Atualize para receber as melhorias mais recentes.",
        duration: Infinity,
        action: {
          label: "Atualizar",
          onClick: () => emEspera.postMessage("pular-espera"),
        },
      });
    }

    navigator.serviceWorker.addEventListener("controllerchange", aoTrocarVersao);

    let registro: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (cancelado) return;
        registro = reg;

        // Versão nova que já ficou esperando de uma visita anterior.
        if (reg.waiting && navigator.serviceWorker.controller) {
          avisarVersaoNova(reg.waiting);
        }

        reg.addEventListener("updatefound", () => {
          const novo = reg.installing;
          if (!novo) return;
          novo.addEventListener("statechange", () => {
            // Sem controller é a primeira instalação: nada a avisar.
            if (novo.state === "installed" && navigator.serviceWorker.controller) {
              avisarVersaoNova(novo);
            }
          });
        });
      })
      .catch(() => {
        // Registrar é um extra. Se falhar, o painel continua funcionando
        // normalmente pela rede.
      });

    // Procura versão nova toda vez que o app volta para a frente, que é
    // como o celular costuma ser usado (abre, usa, minimiza).
    function aoVoltarParaFrente() {
      if (document.visibilityState !== "visible") return;
      registro?.update().catch(() => {});
    }

    document.addEventListener("visibilitychange", aoVoltarParaFrente);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", aoVoltarParaFrente);
      navigator.serviceWorker.removeEventListener("controllerchange", aoTrocarVersao);
    };
  }, []);

  return null;
}
