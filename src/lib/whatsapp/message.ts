import "server-only";
import { prisma } from "../prisma";
import { formatBRL } from "../format";
import { createLink, publicUrl } from "../links";
import type { Settings } from "../settings";
import { LinkKind } from "@/generated/prisma";
import { parseWordList, matchedWords } from "../word-filter";

/// Corpo usado quando não existe nenhum MessageTemplate cadastrado ainda —
/// a app tem que funcionar sem setup nenhum no painel de frases.
const FALLBACK_TEMPLATE =
  "🔥 {{titulo}}\n~De {{precoAntigo}}~ por *{{preco}}* ({{desconto}} OFF)\n{{frase}}\n👉 {{link}}";

function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}

/// Sorteia uma frase ativa vinculada (via PhraseWatch) ao watch do produto da
/// oferta (produto sem watch usa o pool de frases sem nenhum vínculo, `none`)
/// e soma o uso. Sem fallback cruzado: sem frase pro watchId exato, devolve
/// string vazia — o template simplesmente fica sem ela.
///
/// Dentro desse pool por categoria, "específica ganha": frase com keyword só
/// concorre quando bate no título (ver `pool` abaixo); sem nenhuma batida,
/// cai pras frases sem keyword nenhuma, que é o comportamento de sempre.
async function pickPhrase(watchId: string | null, productTitle: string): Promise<string> {
  const phrases = await prisma.phrase.findMany({
    where: {
      active: true,
      watches: watchId ? { some: { watchId } } : { none: {} },
    },
    select: { id: true, text: true, keywords: true },
  });
  if (phrases.length === 0) return "";

  // "Específica ganha": frase com keyword configurada só concorre quando
  // uma delas bate no título do produto. Se alguma bateu, o sorteio fica
  // restrito a essas (senão configurar keyword nunca mudaria nada — ficaria
  // diluído entre as genéricas); se nenhuma bateu (ou nenhuma frase da
  // categoria tem keyword), cai pro comportamento de sempre: sorteia entre
  // as frases sem keyword nenhuma.
  const especificas = phrases.filter((p) => {
    const kws = parseWordList(p.keywords);
    return kws.length > 0 && matchedWords(productTitle, kws).length > 0;
  });
  const pool = especificas.length > 0 ? especificas : phrases.filter((p) => parseWordList(p.keywords).length === 0);
  if (pool.length === 0) return "";

  const chosen = pool[Math.floor(Math.random() * pool.length)];
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
  product: { title: string; watchId: string | null };
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
    pickPhrase(offer.product.watchId, offer.product.title),
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
