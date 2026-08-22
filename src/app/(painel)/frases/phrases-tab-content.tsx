import { getPhraseWatchOptions, getPhrasesWithGroups } from "@/lib/data/phrases";
import { PhrasesManager } from "./phrases-manager";

/// Server Component: lê do banco (cache por TAGS.phrases) e entrega pronto
/// pro client component interativo.
export async function PhrasesTabContent() {
  const [{ phrases, groups }, watches] = await Promise.all([
    getPhrasesWithGroups(),
    getPhraseWatchOptions(),
  ]);

  return <PhrasesManager phrases={phrases} groups={groups} watches={watches} />;
}
