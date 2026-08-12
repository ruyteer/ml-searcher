/// Mapa único de valor técnico -> rótulo legível para a área de Frases.
/// O valor cru (o que fica salvo no banco e na URL) nunca muda; só o texto
/// exibido pra pessoa usando o painel passa por aqui. Use `getCategoryLabel`
/// em qualquer lugar que mostrar uma categoria (lista, badges, selects,
/// combobox, filtros) pra nunca vazar um nome técnico pro usuário.
export const CATEGORY_LABELS: Record<string, string> = {
  abertura: "Chamada de abertura",
  urgencia: "Senso de urgência",
  cta: "Chamada para ação",
  emoji: "Enfeites e emojis",
  geral: "Frases gerais",
};

/// Ordem preferida das categorias conhecidas. Categorias novas, criadas pelo
/// usuário via combobox, entram depois disso, em ordem alfabética.
export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

/// Rótulo legível de uma categoria: usa o mapa conhecido quando existe, ou
/// capitaliza a primeira letra do texto digitado pelo usuário quando é uma
/// categoria nova.
export function getCategoryLabel(value: string): string {
  return CATEGORY_LABELS[value] ?? capitalize(value);
}

export type PhraseSortBy = "recent" | "usage";

/// Rótulo legível de cada opção de ordenação da lista de frases.
export const SORT_LABELS: Record<PhraseSortBy, string> = {
  recent: "Mais recentes",
  usage: "Mais usadas",
};
