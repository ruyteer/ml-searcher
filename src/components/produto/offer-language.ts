/// Vocabulário exibido ao usuário.
///
/// O banco guarda códigos ("HISTORY_AVG", "NEW", "unblocked", "score"...). Nada
/// disso pode vazar para a tela: o dono do painel não é programador e já
/// reclamou de "watch", "all" e "score" aparecerem sem explicação. Este arquivo
/// é o único lugar onde código vira frase em português.
///
/// Sem nenhum import de servidor: é consumido por componentes cliente.
/// Nunca use travessão "—" nos textos daqui.

// ------------------------------------------------- de onde veio a comparação

export interface ReferenceCopy {
  /// Texto curtinho para badge (cabe no card).
  badge: string;
  /// Uma linha, explicando a origem da comparação.
  line: string;
  /// Parágrafo completo, usado no detalhe e no histórico.
  full: string;
  /// Rótulo do preço antigo ("Antes", "Preço cheio"...).
  beforeLabel: string;
}

const REFERENCE_COPY: Record<string, ReferenceCopy> = {
  ML_ORIGINAL: {
    badge: "De/por do Mercado Livre",
    line: "O próprio Mercado Livre marcou de/por",
    full: "O próprio Mercado Livre marcou este anúncio como de/por. O preço riscado é o preço cheio que o vendedor declara na página do produto.",
    beforeLabel: "Preço cheio",
  },
  HISTORY_AVG: {
    badge: "Abaixo da média de 30 dias",
    line: "Está abaixo da média dos últimos 30 dias",
    full: "Guardamos o preço deste produto a cada varredura. O valor comparado é a média dos últimos 30 dias, ou seja: hoje ele está mais barato do que costuma ficar.",
    beforeLabel: "Média de 30 dias",
  },
  HISTORY_MIN: {
    badge: "Menor preço já visto",
    line: "É o menor preço desde que começamos a acompanhar",
    full: "É o preço mais baixo que já registramos para este produto desde que começamos a acompanhar. O valor comparado é o menor preço anterior.",
    beforeLabel: "Menor preço anterior",
  },
};

const REFERENCE_FALLBACK: ReferenceCopy = {
  badge: "Comparado com o preço anterior",
  line: "Está mais barato que o preço anterior",
  full: "Comparamos o preço de hoje com o último preço que tínhamos registrado para este produto.",
  beforeLabel: "Antes",
};

/// Traduz o referenceKind da oferta (ML_ORIGINAL | HISTORY_AVG | HISTORY_MIN)
/// para as frases exibidas. Nunca devolve o código cru.
export function referenceCopy(kind: string): ReferenceCopy {
  return REFERENCE_COPY[kind] ?? REFERENCE_FALLBACK;
}

// -------------------------------------------------------------- oportunidade

/// O banco chama de "score" (0-100). Na tela é sempre "oportunidade".
export const OPPORTUNITY_TERM = "oportunidade";

/// Uma linha explicando de onde sai a nota. Aparece junto de todo número.
export const OPPORTUNITY_EXPLAIN =
  "Nota de 0 a 100 que junta quatro coisas: o tamanho do desconto, a reputação do vendedor, quanto o produto já vendeu e se tem frete grátis.";

export interface OpportunityCopy {
  /// "Ótima", "Boa", "Média", "Fraca".
  label: string;
  /// Classe de cor do texto.
  tone: string;
}

export function opportunityCopy(score: number): OpportunityCopy {
  if (score >= 75) return { label: "Ótima", tone: "text-success" };
  if (score >= 55) return { label: "Boa", tone: "text-foreground" };
  if (score >= 35) return { label: "Média", tone: "text-muted-foreground" };
  return { label: "Fraca", tone: "text-muted-foreground" };
}

// --------------------------------------------------------- situação da oferta

/// NEW / PUBLISHED / IGNORED como o usuário lê.
export const OFFER_STATUS_LABEL: Record<string, string> = {
  NEW: "Nova",
  PUBLISHED: "Já publicada",
  IGNORED: "Ignorada",
};

/// Mesmas situações no plural, para filtros e contadores.
export const OFFER_STATUS_LABEL_PLURAL: Record<string, string> = {
  NEW: "Novas",
  PUBLISHED: "Já publicadas",
  IGNORED: "Ignoradas",
  ALL: "Todas",
};

export function offerStatusLabel(status: string): string {
  return OFFER_STATUS_LABEL[status] ?? status;
}

// ------------------------------------------------------------ tipos de link

/// LinkKind na tela. "slug" nunca aparece: vira "endereço do link".
export const LINK_KIND_LABEL: Record<string, string> = {
  DIRECT: "Link direto",
  TRACKED: "Link rastreado",
  PRESELL: "Link com pre-sell",
};

export function linkKindLabel(kind: string): string {
  return LINK_KIND_LABEL[kind] ?? kind;
}

/// "slug" -> "endereço do link".
export const SLUG_TERM = "endereço do link";

// ------------------------------------------------------------------ produtos

/// A tabela `Watch` do banco é uma categoria que o painel monitora.
export const WATCH_TERM = "categoria monitorada";
export const WATCH_TERM_PLURAL = "categorias monitoradas";

/// BlockedFilter: all | blocked | unblocked.
export const BLOCKED_FILTER_LABEL: Record<string, string> = {
  unblocked: "Disponíveis",
  blocked: "Bloqueados",
  all: "Todos",
};

// ------------------------------------------------------------------- formato

/// "-33%" com sinal explícito, para o badge de desconto.
export function discountLabel(pct: number): string {
  return `${pct}% mais barato`;
}
