import { revalidateTag, updateTag } from "next/cache";

/// Tags de cache usadas em toda a app. Centralizadas aqui para que a
/// invalidação nunca fique dessincronizada de quem consome o dado —
/// o usuário pediu explicitamente que o cache nunca sirva dado velho.

export const TAGS = {
  settings: "settings",
  watches: "watches",
  products: "products",
  offers: "offers",
  links: "links",
  clicks: "clicks",
  presells: "presells",
  phrases: "phrases",
  templates: "templates",
  runs: "runs",
  metrics: "metrics",
  whatsapp: "whatsapp",
} as const;

export type Tag = (typeof TAGS)[keyof typeof TAGS];

/// Um produto mudou de preço -> ofertas e métricas também mudaram.
const CASCADES: Partial<Record<Tag, Tag[]>> = {
  [TAGS.products]: [TAGS.offers, TAGS.metrics],
  [TAGS.offers]: [TAGS.metrics],
  [TAGS.clicks]: [TAGS.links, TAGS.metrics],
  [TAGS.links]: [TAGS.metrics],
  [TAGS.watches]: [TAGS.products],
};

function withCascades(tags: Tag[]): Tag[] {
  const out = new Set<Tag>();
  for (const tag of tags) {
    out.add(tag);
    for (const child of CASCADES[tag] ?? []) out.add(child);
  }
  return [...out];
}

/// Use DENTRO de Server Actions. O Next 16 garante leitura-após-escrita:
/// a mesma requisição que gravou já enxerga o dado novo, sem flash de
/// conteúdo velho ao voltar para a listagem.
///
/// updateTag só é permitido dentro de uma Server Action; chamada de qualquer
/// outro contexto ela lança. Como a gravação já aconteceu quando chegamos
/// aqui, deixar a exceção subir transformaria uma escrita bem-sucedida em
/// erro na cara do usuário. Então caímos para revalidateTag, que vale em
/// qualquer contexto e só abre mão da leitura-após-escrita.
export function bust(...tags: Tag[]) {
  for (const tag of withCascades(tags)) {
    try {
      updateTag(tag);
    } catch {
      revalidateTag(tag, { expire: 0 });
    }
  }
}

/// Use FORA de Server Actions (route handlers, cron, webhooks), onde
/// updateTag não é permitido. Marca a tag como expirada imediatamente.
export function expire(...tags: Tag[]) {
  for (const tag of withCascades(tags)) revalidateTag(tag, { expire: 0 });
}
