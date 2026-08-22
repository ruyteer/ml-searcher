export type PhraseSortBy = "recent" | "usage";

/// Rótulo legível de cada opção de ordenação da lista de frases.
export const SORT_LABELS: Record<PhraseSortBy, string> = {
  recent: "Mais recentes",
  usage: "Mais usadas",
};
