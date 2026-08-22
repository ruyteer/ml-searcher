/// Um ciclo de checagem de elegibilidade de afiliado: valida só um punhado de
/// produtos pendentes por vez (não a fila inteira), com um intervalo mínimo
/// entre ciclos e uma pausa entre cada chamada — de propósito, para não
/// parecer um bot batendo no gerador de link do painel de afiliados.
///
/// Espelha o formato de src/lib/whatsapp/send.ts (runWhatsappCycle): chamado
/// por um cron externo, decide sozinho se é hora e quanto validar. A âncora
/// do próximo ciclo (settings.affiliateCheckNextAt) avança NA GRADE do
/// agendamento logo depois do gate de horário — nunca a partir de quando a
/// checagem terminou, senão a duração das chamadas HTTP e das pausas entre
/// elas empurra a âncora pra fora do tick e o agendamento perde uma janela
/// inteira a cada ciclo.

import "server-only";
import { prisma } from "../prisma";
import { getSettings, setSettings } from "../settings";
import { TAGS, expire } from "../cache";
import { OfferStatus } from "@/generated/prisma";
import { checkAffiliateEligibility, getAffiliateSession } from "./affiliate-eligibility";
import { withAdvisoryLock } from "../db/advisory-lock";

/// Não roda de novo antes disso, contado da última checagem feita.
const MIN_CYCLE_GAP_MS = 15 * 60 * 1000;
const MIN_PER_CYCLE = 1;
const MAX_PER_CYCLE = 2;
/// Pausa entre chamadas dentro do mesmo ciclo (ms).
const DELAY_MIN_MS = 4_000;
const DELAY_MAX_MS = 9_000;
/// Quantos produtos pendentes buscar por vez. Maior que MAX_PER_CYCLE de
/// propósito: um produto com erro persistente (permalink malformado, etc.)
/// não pode travar a fila nele mesmo pra sempre — o ciclo pula pro próximo
/// candidato do pool em vez de tentar sempre os mesmos primeiros.
const PENDING_POOL_TAKE = 20;

/// Chave arbitrária do lock consultivo do Postgres — diferente da usada em
/// src/lib/whatsapp/send.ts (552_013_487), para não colidir com aquele ciclo.
const ADVISORY_LOCK_KEY = 918_273_645;

/// Mesmo teto de tolerância a tick adiantado, latência e skew de relógio que
/// send.ts usa — aqui o intervalo é constante (MIN_CYCLE_GAP_MS), então dá
/// pra calcular uma vez só em vez de por chamada.
const TICK_TOLERANCE_MS = Math.min(60_000, Math.floor(MIN_CYCLE_GAP_MS / 10));

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AffiliateCheckCycleResult {
  checked: number;
  eligible: number;
  rejected: number;
  skipped?: string;
  schedule: {
    now: string;
    nextEligibleAt: string | null;
    dueInMs: number;
    tickToleranceMs: number;
  };
}

function buildSchedule(dueAt: number): AffiliateCheckCycleResult["schedule"] {
  const now = Date.now();
  return {
    now: new Date(now).toISOString(),
    nextEligibleAt: Number.isFinite(dueAt) ? new Date(dueAt).toISOString() : null,
    dueInMs: Number.isFinite(dueAt) ? dueAt - now : 0,
    tickToleranceMs: TICK_TOLERANCE_MS,
  };
}

function skip(reason: string, schedule?: AffiliateCheckCycleResult["schedule"]): AffiliateCheckCycleResult {
  return { checked: 0, eligible: 0, rejected: 0, skipped: reason, schedule: schedule ?? buildSchedule(NaN) };
}

/// Avança a âncora do próximo ciclo NA GRADE do agendamento, nunca a partir
/// de Date.now(): a base é o alvo anterior, então a sequência t0, t0+I,
/// t0+2I... fica alinhada com a do agendador externo mesmo que este ciclo
/// tenha demorado. Uma janela perdida é pulada, não recuperada em rajada.
async function advanceSchedule(dueAt: number, now: number, intervalMs: number): Promise<number> {
  let next = (Number.isFinite(dueAt) ? dueAt : now) + intervalMs;
  if (next <= now) next = now + intervalMs;
  await setSettings({ affiliateCheckNextAt: new Date(next).toISOString() });
  expire(TAGS.settings);
  return next;
}

interface PendingProduct {
  id: string;
  mlId: string;
  catalogId: string | null;
  permalink: string;
}

/// Produtos com oferta NEW pendente de checagem, mais recentes primeiro, sem
/// repetir produto. Deduplica em JS (em vez de `distinct` do Prisma) de
/// propósito: `distinct` vira `DISTINCT ON` no Postgres, que exige que o
/// `ORDER BY` comece pelas colunas do distinct — na prática isso faz o
/// resultado sair ordenado por id do produto, não pela oferta mais recente
/// como o nome do parâmetro promete.
async function findPendingProducts(take: number): Promise<PendingProduct[]> {
  const rows = await prisma.offer.findMany({
    where: {
      status: OfferStatus.NEW,
      product: { affiliateEligible: null, blocked: false, hiddenByWords: false },
    },
    orderBy: { detectedAt: "desc" },
    select: {
      product: { select: { id: true, mlId: true, catalogId: true, permalink: true } },
    },
    // Folga generosa: várias ofertas podem apontar pro mesmo produto.
    take: take * 3,
  });

  const seen = new Set<string>();
  const out: PendingProduct[] = [];
  for (const row of rows) {
    if (seen.has(row.product.id)) continue;
    seen.add(row.product.id);
    out.push(row.product);
    if (out.length >= take) break;
  }
  return out;
}

async function runCycle(): Promise<AffiliateCheckCycleResult> {
  const settings = await getSettings();
  const dueAt = settings.affiliateCheckNextAt ? Date.parse(settings.affiliateCheckNextAt) : NaN;

  if (settings.affiliateSessionInvalid) {
    return skip("sessão do painel de afiliados expirada — cole um curl novo em Configurações", buildSchedule(dueAt));
  }

  const session = await getAffiliateSession();
  if (!session) return skip("sessão do painel de afiliados não configurada", buildSchedule(dueAt));

  if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
    await setSettings({ affiliateSessionInvalid: true });
    return skip("sessão do painel de afiliados expirada — cole um curl novo em Configurações", buildSchedule(dueAt));
  }

  const now = Date.now();
  // Intervalo reduzido não se aplica aqui (MIN_CYCLE_GAP_MS é constante), mas
  // a âncora ainda pode ter ficado corrompida ou muito no passado — se
  // estourou o orçamento do intervalo atual, trata como devida agora, igual
  // send.ts.
  const overBudget = Number.isFinite(dueAt) && dueAt - now > MIN_CYCLE_GAP_MS;
  const effectiveDueAt = overBudget ? now : dueAt;

  if (Number.isFinite(effectiveDueAt) && now + TICK_TOLERANCE_MS < effectiveDueAt) {
    return skip("ainda não é hora do próximo ciclo", buildSchedule(effectiveDueAt));
  }

  // Avança a âncora ANTES de fazer qualquer chamada HTTP ou dormir entre
  // elas: é isto que garante que a duração do ciclo não infle o intervalo
  // efetivo (o mesmo bug já corrigido em send.ts).
  const nextDueAt = await advanceSchedule(effectiveDueAt, now, MIN_CYCLE_GAP_MS);

  const pending = await findPendingProducts(PENDING_POOL_TAKE);
  if (pending.length === 0) {
    return skip("nenhum produto pendente de verificação", buildSchedule(nextDueAt));
  }

  const target = Math.min(pending.length, randomInt(MIN_PER_CYCLE, MAX_PER_CYCLE));

  let checked = 0;
  let eligible = 0;
  let rejected = 0;
  let decided = 0;

  for (let i = 0; i < pending.length && decided < target; i++) {
    const product = pending[i];
    const result = await checkAffiliateEligibility(product, session, settings.affiliateWord);

    if (result.outcome === "session_expired") {
      await setSettings({ affiliateSessionInvalid: true });
      break;
    }

    if (result.outcome === "error") {
      // Falha transitória neste produto: não marca nada, não conta como
      // decidido — o ciclo segue pro próximo candidato do pool em vez de
      // ficar travado tentando sempre o mesmo item.
      console.warn(`[afiliado] falha ao checar ${product.mlId}: ${result.message}`);
    } else {
      checked += 1;
      decided += 1;
      if (result.outcome === "eligible") {
        eligible += 1;
        await prisma.product.update({
          where: { id: product.id },
          data: { affiliateEligible: true, affiliateCheckedAt: new Date(), affiliateCheckError: null },
        });
      } else {
        rejected += 1;
        await prisma.product.update({
          where: { id: product.id },
          data: {
            affiliateEligible: false,
            affiliateCheckedAt: new Date(),
            affiliateCheckError: result.message,
          },
        });
      }
    }

    const hasNext = decided < target && i < pending.length - 1;
    if (hasNext) await sleep(randomInt(DELAY_MIN_MS, DELAY_MAX_MS));
  }

  if (checked > 0) expire(TAGS.offers, TAGS.products);
  return { checked, eligible, rejected, schedule: buildSchedule(nextDueAt) };
}

/// Trava com advisory lock do Postgres: dois disparos sobrepostos do cron
/// (retry do agendador, dois provedores, etc.) não podem bater no ML ao
/// mesmo tempo — justamente o padrão "parecer bot" que a pausa entre
/// chamadas tenta evitar.
export async function runAffiliateCheckCycle(): Promise<AffiliateCheckCycleResult> {
  // Lê a âncora antes do lock pra o fallback de "já está rodando" reportar o
  // agendamento real, em vez de um schedule degenerado (dueInMs sempre 0).
  const settings = await getSettings();
  const dueAt = settings.affiliateCheckNextAt ? Date.parse(settings.affiliateCheckNextAt) : NaN;
  return withAdvisoryLock(
    ADVISORY_LOCK_KEY,
    async () => skip("outro ciclo de checagem já está rodando", buildSchedule(dueAt)),
    runCycle,
  );
}
