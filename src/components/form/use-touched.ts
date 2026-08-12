"use client";

import { useCallback, useState } from "react";

/// Erro de validação client-side só deve aparecer depois do primeiro blur
/// (ou quando o servidor já respondeu com erro) — nunca enquanto a pessoa
/// ainda está digitando o primeiro caractere.
export function useTouched() {
  const [touched, setTouched] = useState(false);
  const markTouched = useCallback(() => setTouched(true), []);
  return [touched, markTouched] as const;
}
