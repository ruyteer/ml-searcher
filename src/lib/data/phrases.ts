import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { TAGS } from "@/lib/cache";
import { listWatchTree } from "@/lib/data/watches";
import type { Phrase, MessageTemplate } from "@/generated/prisma";

// ------------------------------------------------------------------ phrases

/// Phrase com as categorias vinculadas achatadas em `watchIds` — lista vazia
/// é o pool geral (nenhum vínculo em PhraseWatch).
export type PhraseWithWatchIds = Phrase & { watchIds: string[] };

const loadPhrases = unstable_cache(
  async () => {
    const phrases = await prisma.phrase.findMany({
      orderBy: { createdAt: "asc" },
      include: { watches: { select: { watchId: true } } },
    });
    return phrases.map(({ watches, ...phrase }): PhraseWithWatchIds => ({
      ...phrase,
      watchIds: watches.map((w) => w.watchId),
    }));
  },
  ["phrases"],
  { tags: [TAGS.phrases] },
);

export async function getPhrases(): Promise<PhraseWithWatchIds[]> {
  return loadPhrases();
}

export interface PhraseGroupSummary {
  watchId: string | null;
  label: string;
  /// Quantas frases (ativas+inativas) pertencem a este grupo — uma frase com
  /// várias categorias conta em cada uma. É o contador do filtro lateral, não
  /// o total geral de frases.
  count: number;
}

export interface PhrasesView {
  phrases: PhraseWithWatchIds[];
  groups: PhraseGroupSummary[];
}

/// Lista plana de frases (fonte de verdade, sem duplicar linha por
/// categoria) + resumo de grupos por watch pro filtro lateral da aba
/// "Frases". Segue a ordem de árvore de `listWatchTree()`, com o grupo "Sem
/// categoria" sempre por último. Só entram grupos com pelo menos 1 frase.
const loadPhrasesView = unstable_cache(
  async () => {
    const [phrases, watches] = await Promise.all([
      prisma.phrase.findMany({
        orderBy: { createdAt: "asc" },
        include: { watches: { select: { watchId: true } } },
      }),
      listWatchTree(),
    ]);

    const flat: PhraseWithWatchIds[] = phrases.map(({ watches, ...phrase }) => ({
      ...phrase,
      watchIds: watches.map((w) => w.watchId),
    }));

    const counts = new Map<string | null, number>();
    for (const phrase of flat) {
      const keys = phrase.watchIds.length > 0 ? phrase.watchIds : [null];
      for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const groups: PhraseGroupSummary[] = [];
    for (const watch of watches) {
      const count = counts.get(watch.id) ?? 0;
      if (count > 0) groups.push({ watchId: watch.id, label: watch.label, count });
    }

    const semCategoria = counts.get(null) ?? 0;
    if (semCategoria > 0) groups.push({ watchId: null, label: "Sem categoria", count: semCategoria });

    return { phrases: flat, groups };
  },
  ["phrases-view"],
  { tags: [TAGS.phrases, TAGS.watches] },
);

export async function getPhrasesWithGroups(): Promise<PhrasesView> {
  return loadPhrasesView();
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
