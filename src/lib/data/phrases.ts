import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { TAGS } from "@/lib/cache";
import { CATEGORY_ORDER } from "@/lib/frases-labels";
import type { Phrase, MessageTemplate } from "@/generated/prisma";

// ------------------------------------------------------------------ phrases

const loadPhrases = unstable_cache(
  async () => prisma.phrase.findMany({ orderBy: [{ category: "asc" }, { createdAt: "asc" }] }),
  ["phrases"],
  { tags: [TAGS.phrases] },
);

export async function getPhrases(): Promise<Phrase[]> {
  return loadPhrases();
}

export interface PhraseGroup {
  category: string;
  phrases: Phrase[];
}

function categoryRank(category: string): number {
  const idx = CATEGORY_ORDER.indexOf(category);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

/// Frases agrupadas por categoria, na ordem exibida pela aba "Frases".
export async function getPhrasesGroupedByCategory(): Promise<PhraseGroup[]> {
  const phrases = await getPhrases();
  const byCategory = new Map<string, Phrase[]>();
  for (const phrase of phrases) {
    const list = byCategory.get(phrase.category) ?? [];
    list.push(phrase);
    byCategory.set(phrase.category, list);
  }

  const categories = [...byCategory.keys()].sort((a, b) => {
    const rankDiff = categoryRank(a) - categoryRank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.localeCompare(b, "pt-BR");
  });

  return categories.map((category) => ({ category, phrases: byCategory.get(category)! }));
}

/// Categorias já usadas — alimenta as sugestões do Combobox de categoria.
export async function getPhraseCategories(): Promise<string[]> {
  const phrases = await getPhrases();
  const set = new Set(phrases.map((p) => p.category));
  return [...set].sort((a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b, "pt-BR"));
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
