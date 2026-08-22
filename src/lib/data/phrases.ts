import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { TAGS } from "@/lib/cache";
import { listWatchTree } from "@/lib/data/watches";
import type { Phrase, MessageTemplate } from "@/generated/prisma";

// ------------------------------------------------------------------ phrases

const loadPhrases = unstable_cache(
  async () => prisma.phrase.findMany({ orderBy: { createdAt: "asc" } }),
  ["phrases"],
  { tags: [TAGS.phrases] },
);

export async function getPhrases(): Promise<Phrase[]> {
  return loadPhrases();
}

export interface PhraseGroup {
  watchId: string | null;
  label: string;
  phrases: Phrase[];
}

/// Frases agrupadas por watch, na ordem exibida pela aba "Frases": segue a
/// ordem de árvore de `listWatchTree()`, com o grupo "Sem categoria"
/// (watchId nulo) sempre por último. Só entram grupos com pelo menos 1 frase.
const loadPhrasesGroupedByWatch = unstable_cache(
  async () => {
    const [phrases, watches] = await Promise.all([
      prisma.phrase.findMany({ orderBy: { createdAt: "asc" } }),
      listWatchTree(),
    ]);

    const byWatch = new Map<string | null, Phrase[]>();
    for (const phrase of phrases) {
      const list = byWatch.get(phrase.watchId) ?? [];
      list.push(phrase);
      byWatch.set(phrase.watchId, list);
    }

    const groups: PhraseGroup[] = [];
    for (const watch of watches) {
      const list = byWatch.get(watch.id);
      if (list) groups.push({ watchId: watch.id, label: watch.label, phrases: list });
    }

    const semCategoria = byWatch.get(null);
    if (semCategoria) groups.push({ watchId: null, label: "Sem categoria", phrases: semCategoria });

    return groups;
  },
  ["phrases-grouped-by-watch"],
  { tags: [TAGS.phrases, TAGS.watches] },
);

export async function getPhrasesGroupedByWatch(): Promise<PhraseGroup[]> {
  return loadPhrasesGroupedByWatch();
}

/// Opções de watch pro seletor de categoria da aba Frases — repasse de
/// `listWatchTree()` no shape que a UI precisa.
export async function getPhraseWatchOptions(): Promise<{ id: string; label: string; depth: number }[]> {
  const watches = await listWatchTree();
  return watches.map((w) => ({ id: w.id, label: w.label, depth: w.depth }));
}

// ---------------------------------------------------------------- templates

const loadTemplates = unstable_cache(
  async () => prisma.messageTemplate.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
  ["templates"],
  { tags: [TAGS.templates] },
);

export async function getTemplates(): Promise<MessageTemplate[]> {
  return loadTemplates();
}

export async function getDefaultTemplate(): Promise<MessageTemplate | null> {
  const templates = await getTemplates();
  return templates.find((t) => t.isDefault) ?? templates[0] ?? null;
}
