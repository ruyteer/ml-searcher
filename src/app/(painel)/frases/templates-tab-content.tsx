import { getPhrases, getTemplates } from "@/lib/data/phrases";
import { TemplatesManager } from "./templates-manager";

/// Server Component: lê templates (TAGS.templates) e frases (TAGS.phrases,
/// usadas só pelo PhrasePicker do preview) e entrega pronto pro client.
export async function TemplatesTabContent() {
  const [templates, phrases] = await Promise.all([getTemplates(), getPhrases()]);

  return <TemplatesManager templates={templates} phrases={phrases} />;
}
