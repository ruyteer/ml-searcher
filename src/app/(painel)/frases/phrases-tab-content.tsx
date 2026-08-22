import { getPhraseWatchOptions, getPhrasesGroupedByWatch } from "@/lib/data/phrases";
import { PhrasesManager } from "./phrases-manager";

/// Server Component: lê do banco (cache por TAGS.phrases) e entrega pronto
/// pro client component interativo.
export async function PhrasesTabContent() {
  const [groups, watches] = await Promise.all([
    getPhrasesGroupedByWatch(),
    getPhraseWatchOptions(),
  ]);

  return <PhrasesManager groups={groups} watches={watches} />;
}
