import { getPhraseCategories, getPhrasesGroupedByCategory } from "@/lib/data/phrases";
import { PhrasesManager } from "./phrases-manager";

/// Server Component: lê do banco (cache por TAGS.phrases) e entrega pronto
/// pro client component interativo.
export async function PhrasesTabContent() {
  const [groups, categories] = await Promise.all([
    getPhrasesGroupedByCategory(),
    getPhraseCategories(),
  ]);

  return <PhrasesManager groups={groups} categories={categories} />;
}
