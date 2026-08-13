import "server-only";
import { prisma } from "../prisma";
import { getSettings } from "../settings";
import { TAGS, expire } from "../cache";
import { OfferStatus } from "@/generated/prisma";
import { runScrape, startScrapeRun, ScrapeAlreadyRunningError } from "../scraper/run";
import { sendText, sendMedia, UazapiError } from "./uazapi";
import { buildOfferMessage } from "./message";

/// Não dispara uma nova varredura por esgotamento se a última começou há
/// menos tempo que isto — evita bater no ML a cada tick do cron só porque a
/// varredura anterior não achou nada novo.
const MIN_RESCRAPE_GAP_MS = 15 * 60 * 1000;
/// Teto de ofertas candidatas carregadas por ciclo.
const CANDIDATE_TAKE = 50;

function randomInt(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

async function findEligibleOffers(take: number) {
  return prisma.offer.findMany({
    where: {
      status: OfferStatus.NEW,
      whatsappSentAt: null,
      product: { blocked: false, hiddenByWords: false },
    },
    orderBy: [{ score: "desc" }, { detectedAt: "asc" }],
    take,
    include: { product: { select: { title: true, thumbnail: true } } },
  });
}

/// Há uma varredura recente o bastante pra não valer a pena tentar de novo agora?
async function scrapedRecently(): Promise<boolean> {
  const latest = await prisma.scrapeRun.findFirst({
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  return Boolean(latest && Date.now() - latest.startedAt.getTime() < MIN_RESCRAPE_GAP_MS);
}

export interface WhatsappCycleResult {
  sent: number;
  attempted: number;
  groups: number;
  rescraped: boolean;
  skipped?: string;
}

function skip(reason: string): WhatsappCycleResult {
  return { sent: 0, attempted: 0, groups: 0, rescraped: false, skipped: reason };
}

/// Um ciclo do envio automático: decide se é hora, escolhe 1 a N ofertas
/// (configurável) que ainda não foram mandadas pro WhatsApp, manda pra cada
/// grupo habilitado com preview de link, e registra tudo em SendLog. Nunca
/// marca a oferta como PUBLISHED — só evita reenviar a mesma no próximo
/// ciclo. Quando não sobra oferta elegível, dispara uma nova varredura e
/// tenta de novo antes de desistir.
export async function runWhatsappCycle(requestHeaders?: Headers): Promise<WhatsappCycleResult> {
  const settings = await getSettings();
  if (!settings.whatsappEnabled) return skip("desativado nas configurações");

  const instance = await prisma.whatsappInstance.findFirst({
    where: { active: true, status: "connected" },
    include: { groups: { where: { enabled: true } } },
  });
  if (!instance) return skip("sem instância conectada");
  if (instance.groups.length === 0) return skip("sem grupos habilitados");

  const intervalMs = Math.max(1, settings.whatsappIntervalMinutes) * 60_000;
  const lastSent = await prisma.sendLog.findFirst({
    where: { status: "sent" },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  if (lastSent?.sentAt && Date.now() - lastSent.sentAt.getTime() < intervalMs) {
    return skip("ainda não é hora do próximo ciclo");
  }

  let eligible = await findEligibleOffers(CANDIDATE_TAKE);
  let rescraped = false;

  if (eligible.length === 0 && !(await scrapedRecently())) {
    rescraped = true;
    try {
      const started = await startScrapeRun("cron");
      await runScrape({ trigger: "cron", runId: started.runId });
      expire(TAGS.products, TAGS.offers, TAGS.runs);
    } catch (err) {
      if (!(err instanceof ScrapeAlreadyRunningError)) throw err;
    }
    eligible = await findEligibleOffers(CANDIDATE_TAKE);
  }

  if (eligible.length === 0) return { ...skip("sem ofertas elegíveis"), rescraped };

  const count = Math.min(eligible.length, randomInt(settings.whatsappMinPerCycle, settings.whatsappMaxPerCycle));
  const batch = eligible.slice(0, count);

  let sent = 0;
  for (const offer of batch) {
    const built = await buildOfferMessage(
      {
        id: offer.id,
        price: offer.price,
        referencePrice: offer.referencePrice,
        discountPct: offer.discountPct,
        productId: offer.productId,
        product: offer.product,
      },
      settings,
      requestHeaders,
    );

    let anySuccess = false;
    for (const group of instance.groups) {
      try {
        // Com foto do produto fica muito melhor a visualização no grupo — a
        // legenda leva o mesmo texto que iria no envio só-texto. Sem
        // thumbnail (raro), cai pro texto com preview de link normal.
        if (offer.product.thumbnail) {
          await sendMedia(instance.host, instance.token, {
            number: group.remoteJid,
            media: offer.product.thumbnail,
            type: "image",
            caption: built.text,
          });
        } else {
          await sendText(instance.host, instance.token, {
            number: group.remoteJid,
            text: built.text,
            linkPreview: true,
          });
        }
        await prisma.sendLog.create({
          data: {
            instanceId: instance.id,
            groupId: group.id,
            message: built.text,
            linkId: built.linkId,
            status: "sent",
            sentAt: new Date(),
          },
        });
        anySuccess = true;
      } catch (err) {
        const error = err instanceof UazapiError ? err.message : err instanceof Error ? err.message : String(err);
        await prisma.sendLog.create({
          data: {
            instanceId: instance.id,
            groupId: group.id,
            message: built.text,
            linkId: built.linkId,
            status: "failed",
            error,
          },
        });
      }
    }

    // Marca como enviada mesmo se todos os grupos falharam: evita ficar
    // tentando pra sempre a mesma oferta problemática a cada ciclo.
    await prisma.offer.update({ where: { id: offer.id }, data: { whatsappSentAt: new Date() } });
    if (anySuccess) sent += 1;
  }

  expire(TAGS.whatsapp, TAGS.offers, TAGS.links);
  return { sent, attempted: batch.length, groups: instance.groups.length, rescraped };
}
