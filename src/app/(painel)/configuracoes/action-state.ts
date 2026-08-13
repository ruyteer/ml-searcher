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

// ------------------------------------------------- filtro por palavras

/// Prévia do impacto de uma lista de palavras que ainda NÃO foi salva: quantos
/// produtos e quantas ofertas ficariam escondidos se ela valesse agora.
/// Não usa useActionState (é chamada direta, com atraso, enquanto a pessoa
/// digita), por isso não tem `ts`.
export interface PrevisaoDoFiltro {
  ok: boolean;
  message: string;
  produtosEscondidos: number;
  produtosTotal: number;
  ofertasEscondidas: number;
  ofertasTotal: number;
}

export const PREVISAO_VAZIA: PrevisaoDoFiltro = {
  ok: true,
  message: "",
  produtosEscondidos: 0,
  produtosTotal: 0,
  ofertasEscondidas: 0,
  ofertasTotal: 0,
};

// ------------------------------------------------- detecção: o que aparece

/// Os valores do formulário de detecção que decidem o que APARECE, do jeito
/// que o cliente já os tem em mãos. `minPrice` vai em centavos (o campo é
/// mascarado, o cliente converte com moneyToCents antes de mandar).
export interface EntradaDaPrevisaoDeDeteccao {
  minDiscount: number;
  hotDiscount: number;
  minPrice: number;
  minSoldQuantity: number;
}

/// Prévia do efeito de uma configuração de detecção que ainda NÃO foi salva:
/// quantas ofertas continuam aparecendo, quantas ficam escondidas e quantas
/// ganham o destaque de imperdível. Nenhuma é apagada em momento algum.
/// Não usa useActionState (é chamada direta, com atraso, enquanto a pessoa
/// mexe nos campos), por isso não tem `ts`.
export interface PrevisaoDaDeteccao {
  ok: boolean;
  message: string;
  visiveis: number;
  escondidas: number;
  imperdiveis: number;
  total: number;
}

export const PREVISAO_DETECCAO_VAZIA: PrevisaoDaDeteccao = {
  ok: true,
  message: "",
  visiveis: 0,
  escondidas: 0,
  imperdiveis: 0,
  total: 0,
};

/// Resultado de uma exclusão (uma ou várias de uma vez).
export interface ExclusaoResult extends ActionState {
  /// Ids que saíram de verdade, para a lista sumir na hora.
  excluidos: string[];
}
