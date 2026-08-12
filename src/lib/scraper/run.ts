/// Orquestração da varredura: percorre as watches habilitadas, persiste
/// produtos e histórico de preço e cria as ofertas detectadas.

import type { RunStatus, Watch } from "@/generated/prisma";
import { prisma } from "../prisma";
import { getSettings } from "../settings";
import { collectForWatch, getCollectionMode, isFixtureMode, isMLApiError } from "../ml";
import type { NormalizedProduct } from "../ml";
import { detect } from "./detect";
import type { PricePoint } from "./detect";

/// Quantos upserts por transação.
const UPSERT_CHUNK = 25;
/// O Postgres é remoto (Railway), então o round-trip por upsert pesa: os 5s
/// padrão do Prisma estouram no meio do chunk. Estes limites são folgados de
/// propósito — a varredura roda em background, ninguém está esperando.
const TX_OPTIONS = { timeout: 60_000, maxWait: 20_000 } as const;
/// Janela do histórico usada como referência.
const HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/// Não recriar a mesma oferta (mesmo produto, mesmo preço) dentro desta janela.
const OFFER_DEDUPE_MS = 12 * 60 * 60 * 1000;
/// Teto de linhas guardadas em ScrapeRun.log.
const MAX_LOG_LINES = 800;

export interface RunScrapeOptions {
  trigger?: "manual" | "cron";
  signal?: AbortSignal;
}

export interface RunScrapeResult {
  runId: string;
  status: RunStatus;
  watchesTotal: number;
  watchesDone: number;
  itemsSeen: number;
  productsNew: number;
  offersNew: number;
  failures: string[];
}

export interface RunProgress {
  id: string;
  status: RunStatus;
  trigger: string;
  watchesTotal: number;
  watchesDone: number;
  itemsSeen: number;
  productsNew: number;
  offersNew: number;
  error: string | null;
  log: string[];
  startedAt: Date;
  finishedAt: Date | null;
  running: boolean;
  /// 0-100, baseado nas watches concluídas.
  percent: number;
  durationMs: number;
}

// ------------------------------------------------------------------ helpers

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function stamp(date: Date): string {
  return date.toTimeString().slice(0, 8);
}

function errorMessage(err: unknown): string {
  if (isMLApiError(err)) return `[${err.code}] ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

/// Acumulador de log com carimbo de hora, em português.
class RunLog {
  private lines: string[] = [];

  add(text: string): void {
    this.lines.push(`[${stamp(new Date())}] ${text}`);
    if (this.lines.length > MAX_LOG_LINES) {
      this.lines = this.lines.slice(-MAX_LOG_LINES);
    }
  }

  toString(): string {
    return this.lines.join("\n");
  }
}

function productFields(product: NormalizedProduct, watchId: string, now: Date) {
  return {
    catalogId: product.catalogId,
    title: product.title,
    thumbnail: product.thumbnail,
    permalink: product.permalink,
    price: product.price,
    originalPrice: product.originalPrice,
    currency: product.currency,
    categoryId: product.categoryId,
    sellerId: product.sellerId,
    sellerName: product.sellerName,
    sellerStatus: product.sellerStatus,
    freeShipping: product.freeShipping,
    soldQuantity: product.soldQuantity,
    available: product.available,
    condition: product.condition,
    officialStore: product.officialStore,
    watchId,
    lastSeenAt: now,
  };
}

// --------------------------------------------------------- varredura de uma watch

interface WatchOutcome {
  itemsSeen: number;
  productsNew: number;
  offersNew: number;
  /// Produtos descartados por caírem fora da árvore de Beleza (MLB1246).
  offNiche: number;
}

interface WatchContext {
  runId: string;
  log: RunLog;
  settings: Awaited<ReturnType<typeof getSettings>>;
  signal?: AbortSignal;
}

async function processWatch(watch: Watch, ctx: WatchContext): Promise<WatchOutcome> {
  const { log, settings } = ctx;
  const now = new Date();

  const collected = await collectForWatch(watch, { signal: ctx.signal });
  const found = collected.products;

  // Watch sem termo e sem categoria não tem por onde coletar. Não é falha da
  // API: é configuração incompleta da watch.
  if (collected.skipped) {
    log.add(`Watch "${watch.label}": ${collected.note}.`);
    return { itemsSeen: 0, productsNew: 0, offersNew: 0, offNiche: collected.offNiche };
  }

  log.add(
    `Watch "${watch.label}": ${collected.note} -> ${found.length} produto(s) para avaliar.`,
  );
  if (found.length === 0) return { itemsSeen: 0, productsNew: 0, offersNew: 0, offNiche: collected.offNiche };

  const mlIds = found.map((p) => p.mlId);

  // Estado atual no banco: precisamos saber quem é novo e quem está bloqueado.
  const existing = await prisma.product.findMany({
    where: { mlId: { in: mlIds } },
    select: { id: true, mlId: true, blocked: true },
  });
  const existingByMlId = new Map(existing.map((row) => [row.mlId, row]));

  const blocked = existing.filter((row) => row.blocked);
  const actionable = found.filter((p) => !existingByMlId.get(p.mlId)?.blocked);
  if (blocked.length > 0) {
    log.add(`Watch "${watch.label}": ${blocked.length} produto(s) bloqueado(s) ignorado(s).`);
  }
  if (actionable.length === 0) {
    return { itemsSeen: found.length, productsNew: 0, offersNew: 0, offNiche: collected.offNiche };
  }

  const productsNew = actionable.filter((p) => !existingByMlId.has(p.mlId)).length;
  const knownIds = actionable
    .map((p) => existingByMlId.get(p.mlId)?.id)
    .filter((id): id is string => typeof id === "string");

  // O histórico é lido ANTES de gravar o ponto desta varredura, senão a
  // captura atual entraria na própria média de referência.
  const historyByProduct = new Map<string, PricePoint[]>();
  const allTimeMin = new Map<string, number>();
  if (knownIds.length > 0) {
    const [points, mins] = await Promise.all([
      prisma.priceHistory.findMany({
        where: { productId: { in: knownIds }, capturedAt: { gte: new Date(now.getTime() - HISTORY_WINDOW_MS) } },
        select: { productId: true, price: true, capturedAt: true },
      }),
      prisma.priceHistory.groupBy({
        by: ["productId"],
        where: { productId: { in: knownIds } },
        _min: { price: true },
      }),
    ]);
    for (const point of points) {
      const list = historyByProduct.get(point.productId);
      if (list) list.push({ price: point.price, capturedAt: point.capturedAt });
      else historyByProduct.set(point.productId, [{ price: point.price, capturedAt: point.capturedAt }]);
    }
    for (const row of mins) {
      if (typeof row._min.price === "number") allTimeMin.set(row.productId, row._min.price);
    }
  }

  // Upserts em lote: uma transação por chunk, não um round-trip por produto.
  const idByMlId = new Map<string, string>();
  for (const part of chunk(actionable, UPSERT_CHUNK)) {
    const rows = await prisma.$transaction(
      part.map((product) =>
        prisma.product.upsert({
          where: { mlId: product.mlId },
          // firstSeenAt fica de fora do update para não ser sobrescrito.
          create: { mlId: product.mlId, firstSeenAt: now, ...productFields(product, watch.id, now) },
          update: productFields(product, watch.id, now),
          select: { id: true, mlId: true },
        }),
      ),
      TX_OPTIONS,
    );
    for (const row of rows) idByMlId.set(row.mlId, row.id);
  }

  // Um ponto de preço por produto por varredura.
  const pricePoints = actionable
    .map((product) => ({ productId: idByMlId.get(product.mlId), price: product.price, capturedAt: now }))
    .filter((row): row is { productId: string; price: number; capturedAt: Date } => !!row.productId);
  if (pricePoints.length > 0) await prisma.priceHistory.createMany({ data: pricePoints });

  // Detecção.
  const candidates: Array<{ productId: string; price: number; referencePrice: number; referenceKind: string; discountPct: number; score: number }> = [];
  let hotCount = 0;

  for (const product of actionable) {
    const productId = idByMlId.get(product.mlId);
    if (!productId) continue;

    const result = detect({
      product,
      history: historyByProduct.get(productId),
      settings,
      watchMinDiscount: watch.minDiscount,
      historyMin: allTimeMin.get(productId) ?? null,
      now,
    });
    if (!result.isOffer) continue;

    if (result.hot) hotCount += 1;
    candidates.push({
      productId,
      price: product.price,
      referencePrice: result.referencePrice,
      referenceKind: result.referenceKind,
      discountPct: result.discountPct,
      score: result.score,
    });
  }

  if (candidates.length === 0) {
    log.add(`Watch "${watch.label}": nenhuma oferta acima do limite de desconto.`);
    return { itemsSeen: found.length, productsNew, offersNew: 0, offNiche: collected.offNiche };
  }

  // Deduplicação: mesma oferta (produto + preço) nas últimas 12h não repete.
  const recent = await prisma.offer.findMany({
    where: {
      productId: { in: candidates.map((c) => c.productId) },
      detectedAt: { gte: new Date(now.getTime() - OFFER_DEDUPE_MS) },
    },
    select: { productId: true, price: true },
  });
  const alreadySeen = new Set(recent.map((row) => `${row.productId}:${row.price}`));
  const fresh = candidates.filter((c) => !alreadySeen.has(`${c.productId}:${c.price}`));
  const repeated = candidates.length - fresh.length;

  if (fresh.length > 0) {
    await prisma.offer.createMany({
      data: fresh.map((c) => ({ ...c, runId: ctx.runId, detectedAt: now })),
    });
  }

  log.add(
    `Watch "${watch.label}": ${fresh.length} oferta(s) nova(s)` +
      (hotCount > 0 ? `, ${hotCount} imperdível(is)` : "") +
      (repeated > 0 ? `, ${repeated} repetida(s) ignorada(s)` : "") +
      ".",
  );

  return { itemsSeen: found.length, productsNew, offersNew: fresh.length, offNiche: collected.offNiche };
}

// ------------------------------------------------------------------- runScrape

/// Uma varredura travada (processo morto no meio) não pode bloquear as
/// próximas para sempre — depois disso o RUNNING é considerado órfão.
const STALE_RUN_MS = 30 * 60 * 1000;

export class ScrapeAlreadyRunningError extends Error {
  constructor(public readonly runId: string) {
    super("Já existe uma varredura em andamento");
    this.name = "ScrapeAlreadyRunningError";
  }
}

/// Marca como FAILED as execuções RUNNING antigas demais e devolve a que
/// ainda está viva, se houver.
async function findActiveRun() {
  const running = await prisma.scrapeRun.findFirst({
    where: { status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });
  if (!running) return null;

  if (Date.now() - running.startedAt.getTime() > STALE_RUN_MS) {
    await prisma.scrapeRun.update({
      where: { id: running.id },
      data: {
        status: "FAILED",
        error: "Execução interrompida (processo encerrado no meio da varredura)",
        finishedAt: new Date(),
      },
    });
    return null;
  }
  return running;
}

export async function runScrape(options: RunScrapeOptions = {}): Promise<RunScrapeResult> {
  const trigger = options.trigger ?? "manual";

  const active = await findActiveRun();
  if (active) throw new ScrapeAlreadyRunningError(active.id);

  const settings = await getSettings();
  const fixture = await isFixtureMode();

  const watches = await prisma.watch.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  });

  const run = await prisma.scrapeRun.create({
    data: { status: "RUNNING", trigger, watchesTotal: watches.length },
    select: { id: true },
  });

  const log = new RunLog();
  log.add(`Varredura iniciada (${trigger}): ${watches.length} watch(es) habilitada(s).`);
  if (fixture) log.add("Modo FIXTURE ativo: dados de exemplo, sem chamadas reais ao Mercado Livre.");
  else {
    const mode = await getCollectionMode();
    log.add(
      mode === "search"
        ? "Fonte preferida: busca por termo no catálogo do ML. Watch sem termo usa os destaques da categoria."
        : "Fonte preferida: destaques de categoria.",
    );
    log.add(
      "Busca por termo: só entram produtos cuja categoria fica dentro de Beleza e Cuidado Pessoal (MLB1246).",
    );
  }
  log.add(
    `Filtros: desconto mínimo ${settings.minDiscount}%, preço mínimo ${settings.minPrice} centavos, ` +
      `${settings.minHistoryPoints} ponto(s) de histórico, ${settings.minSoldQuantity} venda(s).`,
  );

  const totals = { watchesDone: 0, itemsSeen: 0, productsNew: 0, offersNew: 0 };
  const failures: string[] = [];
  /// Fora de `totals` porque o objeto vai direto para o update do ScrapeRun e
  /// a tabela não tem coluna para isso.
  let offNicheTotal = 0;

  /// Espelha o progresso no banco para o painel poder acompanhar ao vivo.
  const flush = async () => {
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: { ...totals, log: log.toString() },
    });
  };

  try {
    for (const watch of watches) {
      try {
        const outcome = await processWatch(watch, {
          runId: run.id,
          log,
          settings,
          signal: options.signal,
        });
        totals.itemsSeen += outcome.itemsSeen;
        totals.productsNew += outcome.productsNew;
        totals.offersNew += outcome.offersNew;
        offNicheTotal += outcome.offNiche;
        await prisma.watch.update({ where: { id: watch.id }, data: { lastRunAt: new Date() } });
      } catch (err) {
        // Uma watch quebrada não pode derrubar as outras.
        const message = errorMessage(err);
        failures.push(`${watch.label}: ${message}`);
        log.add(`ERRO na watch "${watch.label}": ${message}`);
      } finally {
        totals.watchesDone += 1;
        await flush();
      }
    }

    const status: RunStatus =
      failures.length === 0
        ? "SUCCESS"
        : failures.length === watches.length && watches.length > 0
          ? "FAILED"
          : "PARTIAL";

    log.add(
      `Varredura concluída: ${totals.itemsSeen} item(ns) vistos, ${totals.productsNew} produto(s) novo(s), ` +
        `${totals.offersNew} oferta(s) nova(s).`,
    );
    if (offNicheTotal > 0) {
      log.add(
        `${offNicheTotal} produto(s) descartado(s) por estarem fora de Beleza e Cuidado Pessoal (MLB1246).`,
      );
    }
    if (failures.length > 0) log.add(`${failures.length} watch(es) falharam.`);

    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        ...totals,
        status,
        log: log.toString(),
        error: failures.length > 0 ? failures.join(" | ").slice(0, 2000) : null,
        finishedAt: new Date(),
      },
    });

    return { runId: run.id, status, watchesTotal: watches.length, ...totals, failures };
  } catch (err) {
    const message = errorMessage(err);
    log.add(`ERRO fatal na varredura: ${message}`);
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        ...totals,
        status: "FAILED",
        log: log.toString(),
        error: message.slice(0, 2000),
        finishedAt: new Date(),
      },
    });
    throw err;
  }
}

// ---------------------------------------------------------------- progresso

export async function getRunProgress(runId: string): Promise<RunProgress | null> {
  const run = await prisma.scrapeRun.findUnique({ where: { id: runId } });
  if (!run) return null;

  const running = run.status === "RUNNING";
  const percent =
    run.watchesTotal > 0
      ? Math.min(100, Math.round((run.watchesDone / run.watchesTotal) * 100))
      : running
        ? 0
        : 100;

  return {
    id: run.id,
    status: run.status,
    trigger: run.trigger,
    watchesTotal: run.watchesTotal,
    watchesDone: run.watchesDone,
    itemsSeen: run.itemsSeen,
    productsNew: run.productsNew,
    offersNew: run.offersNew,
    error: run.error,
    log: run.log ? run.log.split("\n") : [],
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    running,
    percent,
    durationMs: (run.finishedAt ?? new Date()).getTime() - run.startedAt.getTime(),
  };
}

/// Última varredura registrada — útil para o painel abrir já mostrando algo.
export async function getLatestRun(): Promise<RunProgress | null> {
  const latest = await prisma.scrapeRun.findFirst({
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  return latest ? getRunProgress(latest.id) : null;
}
