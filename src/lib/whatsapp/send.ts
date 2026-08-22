import "server-only";
import { prisma } from "../prisma";
import { getSettings, setSettings, type Settings } from "../settings";
import { TAGS, expire } from "../cache";
import { OfferStatus } from "@/generated/prisma";
import { runScrape, startScrapeRun, ScrapeAlreadyRunningError } from "../scraper/run";
import { sendText, sendMedia, UazapiError } from "./uazapi";
import { buildOfferMessage } from "./message";
import { withAdvisoryLock } from "../db/advisory-lock";

/// Não dispara uma nova varredura por esgotamento se a última começou há
/// menos tempo que isto — evita bater no ML a cada tick do cron só porque a
/// varredura anterior não achou nada novo. É um teto: com intervalo de envio
/// menor que isso (ver Math.min abaixo), a guarda real é o próprio intervalo.
const MIN_RESCRAPE_GAP_MS = 15 * 60 * 1000;
/// Teto de ofertas candidatas carregadas por ciclo.
const CANDIDATE_TAKE = 50;
/// Teto de tolerância a tick adiantado, latência e skew de relógio entre o
/// agendador externo e a app — sem isso, milissegundos de diferença custam
/// uma janela inteira do agendamento. Proporcional ao intervalo configurado
/// (10%) para não engolir uma fatia grande demais de intervalos curtos.
const TICK_TOLERANCE_MS = 60_000;

function tickToleranceFor(intervalMs: number): number {
  return Math.min(TICK_TOLERANCE_MS, Math.floor(intervalMs / 10));
}

/// Chave arbitrária do lock consultivo do Postgres — diferente da usada em
/// src/lib/ml/affiliate-check-cycle.ts, para não colidir com aquele ciclo.
const ADVISORY_LOCK_KEY = 552_013_487;

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
      // affiliateEligible precisa ser TRUE (não só "diferente de false"): o
      // envio automático não pode arriscar mandar um produto ainda pendente
      // de checagem e descobrir depois que o link não gera comissão.
      product: { blocked: false, hiddenByWords: false, affiliateEligible: true },
    },
    orderBy: [{ score: "desc" }, { detectedAt: "asc" }],
    take,
    include: { product: { select: { title: true, thumbnail: true } } },
  });
}

async function countEligibleOffers(): Promise<number> {
  return prisma.offer.count({
    where: {
      status: OfferStatus.NEW,
      whatsappSentAt: null,
      product: { blocked: false, hiddenByWords: false, affiliateEligible: true },
    },
  });
}

/// Há uma varredura recente o bastante pra não valer a pena tentar de novo agora?
async function scrapedRecently(intervalMs: number): Promise<boolean> {
  const gapMs = Math.min(MIN_RESCRAPE_GAP_MS, intervalMs);
  const latest = await prisma.scrapeRun.findFirst({
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });
  return Boolean(latest && Date.now() - latest.startedAt.getTime() < gapMs);
}

async function findConnectedInstance() {
  return prisma.whatsappInstance.findFirst({
    where: { active: true, status: "connected" },
    include: { groups: { where: { enabled: true } } },
  });
}

type ConnectedInstance = NonNullable<Awaited<ReturnType<typeof findConnectedInstance>>>;

export type SkipCode =
  | "disabled"
  | "no_instance"
  | "no_groups"
  | "not_due"
  | "no_eligible_offers"
  | "already_running";

export interface WhatsappCycleResult {
  sent: number;
  attempted: number;
  groups: number;
  rescraped: boolean;
  skipped?: { code: SkipCode; reason: string };
  schedule: {
    now: string;
    intervalMinutes: number;
    lastSentAt: string | null;
    nextEligibleAt: string | null;
    dueInMs: number;
    tickToleranceMs: number;
  };
  pendingOffers: number;
}

/// dueAt vem já resolvido pelo chamador: antes do gate, é o alvo salvo em
/// settings; depois de avançar a grade, é o novo alvo — assim o diagnóstico
/// devolvido reflete o estado real no momento da resposta.
async function buildDiagnostics(
  settings: Settings,
  dueAt: number,
  tickToleranceMs: number,
): Promise<Pick<WhatsappCycleResult, "schedule" | "pendingOffers">> {
  const now = Date.now();
  const [lastSent, pendingOffers] = await Promise.all([
    prisma.sendLog.findFirst({
      where: { status: "sent" },
      orderBy: { sentAt: { sort: "desc", nulls: "last" } },
      select: { sentAt: true },
    }),
    countEligibleOffers(),
  ]);
  return {
    schedule: {
      now: new Date(now).toISOString(),
      intervalMinutes: settings.whatsappIntervalMinutes,
      lastSentAt: lastSent?.sentAt?.toISOString() ?? null,
      nextEligibleAt: Number.isFinite(dueAt) ? new Date(dueAt).toISOString() : null,
      dueInMs: Number.isFinite(dueAt) ? dueAt - now : 0,
      tickToleranceMs,
    },
    pendingOffers,
  };
}

function parseDueAt(settings: Settings): number {
  return settings.whatsappNextSendAt ? Date.parse(settings.whatsappNextSendAt) : NaN;
}

async function skipResult(
  code: SkipCode,
  reason: string,
  settings: Settings,
  dueAt: number,
  tickToleranceMs: number,
  rescraped = false,
): Promise<WhatsappCycleResult> {
  const diagnostics = await buildDiagnostics(settings, dueAt, tickToleranceMs);
  return { sent: 0, attempted: 0, groups: 0, rescraped, skipped: { code, reason }, ...diagnostics };
}

/// Avança a âncora do próximo ciclo NA GRADE do agendamento, nunca a partir
/// de Date.now(): a base é o alvo anterior, então a sequência t0, t0+I,
/// t0+2I... fica alinhada com a do agendador externo mesmo que este ciclo
/// tenha demorado. Uma janela perdida é pulada, não recuperada em rajada.
async function advanceSchedule(dueAt: number, now: number, intervalMs: number): Promise<number> {
  let next = (Number.isFinite(dueAt) ? dueAt : now) + intervalMs;
  if (next <= now) next = now + intervalMs;
  await setSettings({ whatsappNextSendAt: new Date(next).toISOString() });
  expire(TAGS.settings, TAGS.whatsapp);
  return next;
}

async function runCycle(
  settings: Settings,
  instance: ConnectedInstance,
  requestHeaders?: Headers,
): Promise<WhatsappCycleResult> {
  const intervalMs = Math.max(1, settings.whatsappIntervalMinutes) * 60_000;
  const now = Date.now();
  const dueAt = parseDueAt(settings);
  const tickToleranceMs = tickToleranceFor(intervalMs);
  // Intervalo reduzido no painel não pode deixar o usuário preso esperando a
  // âncora antiga vencer (ela pode ter sido calculada com um intervalo bem
  // maior). Comparar contra now+intervalMs a cada tick não funciona: os dois
  // lados avançam juntos e o gate nunca fecha antes da âncora original vencer
  // de verdade. Em vez disso, decide uma vez por ciclo se a âncora estourou o
  // orçamento do intervalo atual — se estourou, trata como devida agora.
  const overBudget = Number.isFinite(dueAt) && dueAt - now > intervalMs;
  const effectiveDueAt = overBudget ? now : dueAt;

  if (Number.isFinite(effectiveDueAt) && now + tickToleranceMs < effectiveDueAt) {
    return skipResult("not_due", "ainda não é hora do próximo ciclo", settings, effectiveDueAt, tickToleranceMs);
  }

  let eligible = await findEligibleOffers(CANDIDATE_TAKE);
  let rescraped = false;
  let scrapeFailed = false;

  if (eligible.length === 0 && !(await scrapedRecently(intervalMs))) {
    rescraped = true;
    try {
      const started = await startScrapeRun("cron");
      await runScrape({ trigger: "cron", runId: started.runId });
      expire(TAGS.products, TAGS.offers, TAGS.runs);
    } catch (err) {
      if (err instanceof ScrapeAlreadyRunningError) {
        // outro ciclo já está varrendo — segue com o que já tinha de elegível.
      } else {
        // Não deixa a âncora travada nem devolve 500 por uma falha do
        // scraper: loga e segue o ciclo com o que já tinha de elegível.
        // runScrape já grava o ScrapeRun como FAILED antes de lançar, então
        // precisa invalidar TAGS.runs aqui também, senão uma tela cacheada
        // mostra o run como RUNNING até revalidar por outro caminho.
        scrapeFailed = true;
        expire(TAGS.runs);
        console.error("whatsapp cron: varredura falhou durante o ciclo de envio", err);
      }
    }
    eligible = await findEligibleOffers(CANDIDATE_TAKE);
  }

  // Avança a âncora em QUALQUER ciclo que passou o gate acima — inclusive
  // sem oferta elegível e inclusive quando o envio falha em todos os grupos.
  // Sem isso o gate fica aberto em todo tick seguinte (ver docstring do
  // módulo) até queimar o backlog de ofertas sem nada entregue.
  const nextDueAt = await advanceSchedule(effectiveDueAt, now, intervalMs);

  if (eligible.length === 0) {
    const reason = scrapeFailed ? "sem ofertas elegíveis (varredura falhou neste ciclo, ver logs)" : "sem ofertas elegíveis";
    return skipResult("no_eligible_offers", reason, settings, nextDueAt, tickToleranceMs, rescraped);
  }

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
            file: offer.product.thumbnail,
            type: "image",
            text: built.text,
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
  const diagnostics = await buildDiagnostics(settings, nextDueAt, tickToleranceMs);
  return { sent, attempted: batch.length, groups: instance.groups.length, rescraped, ...diagnostics };
}

/// Um ciclo do envio automático: decide se é hora, escolhe 1 a N ofertas
/// (configurável) que ainda não foram mandadas pro WhatsApp, manda pra cada
/// grupo habilitado com preview de link, e registra tudo em SendLog. Nunca
/// marca a oferta como PUBLISHED — só evita reenviar a mesma no próximo
/// ciclo. Quando não sobra oferta elegível, dispara uma nova varredura e
/// tenta de novo antes de desistir.
///
/// O gate "já é hora?" usa como âncora settings.whatsappNextSendAt, que
/// avança NA GRADE do agendamento (não a partir de Date.now()) ao final de
/// todo ciclo que passou o gate — nunca a partir de quando o envio terminou,
/// senão a duração do próprio ciclo empurra a âncora pra fora do tick e o
/// agendamento perde uma janela inteira a cada ciclo.
export async function runWhatsappCycle(requestHeaders?: Headers): Promise<WhatsappCycleResult> {
  const settings = await getSettings();
  const dueAt = parseDueAt(settings);
  const intervalMs = Math.max(1, settings.whatsappIntervalMinutes) * 60_000;
  const tickToleranceMs = tickToleranceFor(intervalMs);

  if (!settings.whatsappEnabled) {
    return skipResult("disabled", "desativado nas configurações", settings, dueAt, tickToleranceMs);
  }

  const instance = await findConnectedInstance();
  if (!instance) return skipResult("no_instance", "sem instância conectada", settings, dueAt, tickToleranceMs);
  if (instance.groups.length === 0) {
    return skipResult("no_groups", "sem grupos habilitados", settings, dueAt, tickToleranceMs);
  }

  return withAdvisoryLock(
    ADVISORY_LOCK_KEY,
    () => skipResult("already_running", "outro ciclo de envio já está rodando", settings, dueAt, tickToleranceMs),
    () => runCycle(settings, instance, requestHeaders),
  );
}
