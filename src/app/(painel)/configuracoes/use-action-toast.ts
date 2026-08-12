"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "./action-state";

/// Dispara toast de sucesso/erro sempre que uma Server Action (via
/// useActionState) termina — identificado pelo carimbo `ts`, que muda a
/// cada execução mesmo quando a mensagem se repete.
export function useActionToast(state: ActionState) {
  const seen = useRef(0);

  useEffect(() => {
    if (state.ts === 0 || state.ts === seen.current) return;
    seen.current = state.ts;
    if (state.ok) {
      if (state.message) toast.success(state.message);
    } else {
      toast.error(state.message || "Não foi possível salvar.");
    }
  }, [state]);
}
