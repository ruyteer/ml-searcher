"use client";

import { useEffect } from "react";
import { useLinkStatus } from "next/link";

/// Precisa ser renderizado como filho de um <Link>. Enquanto a navegação
/// desse link está pendente, marca <html data-navigating> para acender a
/// barra de progresso do topo (ver .nav-progress-bar em globals.css). É o
/// feedback imediato que faz a troca de página parecer instantânea.
export function LinkPendingSignal() {
  const { pending } = useLinkStatus();

  useEffect(() => {
    if (!pending) return;
    document.documentElement.setAttribute("data-navigating", "true");
    return () => {
      document.documentElement.removeAttribute("data-navigating");
    };
  }, [pending]);

  return null;
}
