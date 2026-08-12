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

// -------------------------------------------------- descoberta de domínio

/// Um domínio de catálogo sugerido pelo endpoint de descoberta do ML.
export interface DiscoveredDomainOption {
  domainId: string;
  domainName: string;
  categoryId: string | null;
  categoryName: string | null;
  /// A categoria do domínio cai dentro de Beleza e Cuidado Pessoal?
  /// null quando não foi possível confirmar (falha ao resolver a categoria).
  beauty: boolean | null;
}

/// Retorno de discoverDomainsAction — não usa useActionState (é chamada
/// direta a partir do botão "Descobrir domínio"), por isso não tem `ts`.
export interface DomainDiscoveryResult {
  ok: boolean;
  message: string;
  domains: DiscoveredDomainOption[];
}

// ------------------------------------------- categorias monitoradas: números

/// Onde uma categoria cai no nicho de cuidado pessoal masculino.
/// Espelha NicheStanding de @/lib/ml/categories sem importar valor de servidor.
export type CategoriaNoNicho = "masculino" | "fora" | "neutro";

/// Números de uma categoria monitorada, carregados sob demanda pela aba.
export interface CategoriaNumeros {
  id: string;
  produtos: number;
  ofertas: number;
  nicho: CategoriaNoNicho;
}

export interface CategoriaNumerosResult {
  ok: boolean;
  message: string;
  itens: CategoriaNumeros[];
}

/// Resultado de uma exclusão (uma ou várias de uma vez).
export interface ExclusaoResult extends ActionState {
  /// Ids que saíram de verdade, para a lista sumir na hora.
  excluidos: string[];
}
