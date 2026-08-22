import { getPhrases, getPhraseWatchOptions, getTemplates } from "@/lib/data/phrases";
import { TemplatesManager } from "./templates-manager";

/// Server Component: lê templates (TAGS.templates), frases (TAGS.phrases,
/// usadas só pelo PhrasePicker do preview) e os watches que resolvem o
/// rótulo de categoria de cada frase, e entrega pronto pro client.
export async function TemplatesTabContent() {
  const [templates, phrases, watches] = await Promise.all([getTemplates(), getPhrases(), getPhraseWatchOptions()]);

  return <TemplatesManager templates={templates} phrases={phrases} watches={watches} />;
}
