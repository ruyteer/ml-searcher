import "server-only";
import { prisma } from "../prisma";
import { formatBRL } from "../format";
import { createLink, publicUrl } from "../links";
import type { Settings } from "../settings";
import { LinkKind } from "@/generated/prisma";

/// Corpo usado quando não existe nenhum MessageTemplate cadastrado ainda —
/// a app tem que funcionar sem setup nenhum no painel de frases.
const FALLBACK_TEMPLATE =
  "🔥 {{titulo}}\n~De {{precoAntigo}}~ por *{{preco}}* ({{desconto}} OFF)\n{{frase}}\n👉 {{link}}";

function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

/// Sorteia uma frase ativa (qualquer categoria) e soma o uso. Sem frase
/// cadastrada, devolve string vazia — o template simplesmente fica sem ela.
async function pickPhrase(): Promise<string> {
  const phrases = await prisma.phrase.findMany({
    where: { active: true },
    select: { id: true, text: true },
  });
  if (phrases.length === 0) return "";

  const chosen = phrases[Math.floor(Math.random() * phrases.length)];
  await prisma.phrase.update({ where: { id: chosen.id }, data: { usageCount: { increment: 1 } } });
  return chosen.text;
}

async function pickTemplate(): Promise<string> {
  const template =
    (await prisma.messageTemplate.findFirst({ where: { isDefault: true } })) ??
    (await prisma.messageTemplate.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!template) return FALLBACK_TEMPLATE;

  await prisma.messageTemplate.update({
    where: { id: template.id },
    data: { usageCount: { increment: 1 } },
  });
  return template.body;
}

export interface OfferForMessage {
  id: string;
  price: number;
  referencePrice: number;
  discountPct: number;
  productId: string;
  product: { title: string };
}

export interface BuiltMessage {
  text: string;
  linkId: string;
  url: string;
}

/// Monta o texto pronto pra enviar: sorteia frase e template, gera um Link
/// pro produto e substitui as variáveis. Com `whatsappUsePresell` desligado
/// é um link rastreado (TRACKED) que passa por /r/{slug}; ligado, é PRESELL e
/// passa direto por /p/{slug} — mesma convenção do botão "Gerar link".
export async function buildOfferMessage(
  offer: OfferForMessage,
  settings: Settings,
  requestHeaders?: Headers,
): Promise<BuiltMessage> {
  const usePresell = settings.whatsappUsePresell;

  const [phrase, templateBody, link] = await Promise.all([
    pickPhrase(),
    pickTemplate(),
    createLink({
      productId: offer.productId,
      kind: usePresell ? LinkKind.PRESELL : LinkKind.TRACKED,
      presellId: usePresell ? settings.whatsappPresellId || null : null,
    }),
  ]);

  const url = publicUrl(usePresell ? `/p/${link.slug}` : `/r/${link.slug}`, settings, requestHeaders);

  const text = renderTemplate(templateBody, {
    titulo: offer.product.title,
    preco: formatBRL(offer.price),
    precoAntigo: formatBRL(offer.referencePrice),
    desconto: `${offer.discountPct}`,
    link: url,
    frase: phrase,
  }).trim();

  return { text, linkId: link.id, url };
}
