import type { z } from "zod";

/// Estado padrão devolvido por todas as Server Actions desta página. `ts`
/// muda a cada execução (mesmo quando o resultado se repete) e serve de
/// gatilho confiável pro toast e pra fechar diálogos após sucesso.
export interface ActionState {
  ok: boolean;
  message: string;
  errors?: Record<string, string[]>;
  ts: number;
}

export const INITIAL_ACTION_STATE: ActionState = { ok: true, message: "", ts: 0 };

export function ok(message: string): ActionState {
  return { ok: true, message, ts: Date.now() };
}

export function fail(message: string, errors?: Record<string, string[]>): ActionState {
  return { ok: false, message, errors, ts: Date.now() };
}

/// Achata um ZodError em { campo: [mensagens] }, pro form destacar o campo certo.
export function zodErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_root";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
