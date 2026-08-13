import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { TAGS } from "@/lib/cache";
import { getSettings } from "@/lib/settings";
import { OfferStatus } from "@/generated/prisma";

export interface WhatsappGroupRow {
  id: string;
  remoteJid: string;
  name: string;
  enabled: boolean;
}

export interface WhatsappInstanceInfo {
  id: string;
  name: string;
  status: string;
  lastSync: string | null;
}

export interface WhatsappSendLogRow {
  id: string;
  message: string;
  status: string;
  error: string | null;
  groupName: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface WhatsappOverview {
  instance: WhatsappInstanceInfo | null;
  groups: WhatsappGroupRow[];
  schedule: {
    enabled: boolean;
    intervalMinutes: number;
    minPerCycle: number;
    maxPerCycle: number;
    usePresell: boolean;
    presellId: string;
  };
  /// Pre-sells ativas, pro seletor do agendamento. Vazio = nenhuma cadastrada.
  presells: { id: string; title: string }[];
  uazapiHost: string;
  adminTokenConfigured: boolean;
  stats: {
    pendingOffers: number;
    sentToday: number;
    sentTotal: number;
    failedRecent: number;
  };
  recentSends: WhatsappSendLogRow[];
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const RECENT_SENDS_TAKE = 30;

async function fetchOverview(): Promise<WhatsappOverview> {
  const settings = await getSettings();

  const instance = await prisma.whatsappInstance.findFirst({
    where: { active: true },
    include: { groups: { orderBy: { name: "asc" } } },
  });

  const [pendingOffers, sentToday, sentTotal, failedRecent, recentSendsRaw, presells] = await Promise.all([
    prisma.offer.count({
      where: {
        status: OfferStatus.NEW,
        whatsappSentAt: null,
        product: { blocked: false, hiddenByWords: false },
      },
    }),
    prisma.sendLog.count({ where: { status: "sent", sentAt: { gte: startOfToday() } } }),
    prisma.sendLog.count({ where: { status: "sent" } }),
    prisma.sendLog.count({
      where: { status: "failed", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.sendLog.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_SENDS_TAKE,
      include: { group: { select: { name: true } } },
    }),
    prisma.presell.findMany({
      where: { active: true },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  return {
    instance: instance
      ? {
          id: instance.id,
          name: instance.name,
          status: instance.status,
          lastSync: instance.lastSync?.toISOString() ?? null,
        }
      : null,
    groups: (instance?.groups ?? []).map((g) => ({
      id: g.id,
      remoteJid: g.remoteJid,
      name: g.name,
      enabled: g.enabled,
    })),
    schedule: {
      enabled: settings.whatsappEnabled,
      intervalMinutes: settings.whatsappIntervalMinutes,
      minPerCycle: settings.whatsappMinPerCycle,
      maxPerCycle: settings.whatsappMaxPerCycle,
      usePresell: settings.whatsappUsePresell,
      presellId: settings.whatsappPresellId,
    },
    presells,
    uazapiHost: settings.uazapiHost,
    adminTokenConfigured: Boolean(settings.uazapiAdminToken.trim()),
    stats: { pendingOffers, sentToday, sentTotal, failedRecent },
    recentSends: recentSendsRaw.map((row) => ({
      id: row.id,
      message: row.message,
      status: row.status,
      error: row.error,
      groupName: row.group?.name ?? null,
      sentAt: row.sentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export const getWhatsappOverview = unstable_cache(fetchOverview, ["whatsapp-overview"], {
  tags: [TAGS.whatsapp, TAGS.offers, TAGS.settings, TAGS.presells],
});
