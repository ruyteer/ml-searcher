import "server-only";
import { prisma } from "../prisma";
import { getSettings } from "../settings";
import { TAGS, expire } from "../cache";
import * as uazapi from "./uazapi";
import type { WhatsappInstance, WhatsappGroup } from "@/generated/prisma";

export class WhatsappConfigError extends Error {}

async function requireHost(): Promise<{ host: string; adminToken: string }> {
  const settings = await getSettings();
  const host = settings.uazapiHost.trim();
  if (!host) {
    throw new WhatsappConfigError("Configure o host da Uazapi antes de criar uma instância.");
  }
  return { host, adminToken: settings.uazapiAdminToken.trim() };
}

export type InstanceWithGroups = WhatsappInstance & { groups: WhatsappGroup[] };

/// A instância que a app usa pra tudo — só uma fica `active` por vez.
export async function getActiveInstance(): Promise<InstanceWithGroups | null> {
  return prisma.whatsappInstance.findFirst({
    where: { active: true },
    include: { groups: { orderBy: { name: "asc" } } },
  });
}

/// Cria a instância na Uazapi (admintoken) e salva o token dela no banco.
/// Desativa qualquer instância anterior — a app só opera com uma por vez.
export async function createAndSaveInstance(name: string): Promise<WhatsappInstance> {
  const { host, adminToken } = await requireHost();
  if (!adminToken) {
    throw new WhatsappConfigError("Configure o token de administrador da Uazapi antes de criar uma instância.");
  }

  const created = await uazapi.createInstance(host, adminToken, name);
  if (!created.token) throw new Error("A Uazapi não devolveu um token para a instância criada.");

  const instance = await prisma.$transaction(async (tx) => {
    await tx.whatsappInstance.updateMany({ where: { active: true }, data: { active: false } });
    return tx.whatsappInstance.create({
      data: {
        name,
        host,
        token: created.token,
        status: created.status ?? "disconnected",
        active: true,
      },
    });
  });

  expire(TAGS.whatsapp);
  return instance;
}

/// Inicia (ou reinicia) a conexão: gera QR code, ou código de pareamento
/// quando `phone` é informado. O retorno já traz o QR pra tela mostrar.
export async function connectInstance(
  instanceId: string,
  phone?: string,
): Promise<uazapi.UazapiInstance> {
  const instance = await prisma.whatsappInstance.findUniqueOrThrow({ where: { id: instanceId } });
  const result = await uazapi.connectInstance(instance.host, instance.token, phone);

  await prisma.whatsappInstance.update({
    where: { id: instanceId },
    data: { status: result.instance.status ?? "connecting" },
  });
  expire(TAGS.whatsapp);
  return result.instance;
}

/// Consulta o status ao vivo (inclui QR code atualizado enquanto conecta) e
/// espelha no banco. É o que a tela de polling chama a cada poucos segundos.
export async function refreshInstanceStatus(instanceId: string): Promise<uazapi.InstanceStatus> {
  const instance = await prisma.whatsappInstance.findUniqueOrThrow({ where: { id: instanceId } });
  const result = await uazapi.getInstanceStatus(instance.host, instance.token);

  await prisma.whatsappInstance.update({
    where: { id: instanceId },
    data: { status: result.instance.status ?? instance.status, lastSync: new Date() },
  });
  expire(TAGS.whatsapp);
  return result;
}

export async function disconnectInstance(instanceId: string): Promise<void> {
  const instance = await prisma.whatsappInstance.findUniqueOrThrow({ where: { id: instanceId } });
  await uazapi.disconnectInstance(instance.host, instance.token);
  await prisma.whatsappInstance.update({ where: { id: instanceId }, data: { status: "disconnected" } });
  expire(TAGS.whatsapp);
}

/// Busca os grupos reais da conta conectada e sincroniza com o banco. Grupo
/// novo entra desabilitado — o usuário escolhe quais recebem oferta, pra
/// nunca começar mandando promoção num grupo que não é de ofertas.
export async function syncGroups(instanceId: string): Promise<number> {
  const instance = await prisma.whatsappInstance.findUniqueOrThrow({ where: { id: instanceId } });
  const groups = await uazapi.listGroups(instance.host, instance.token, true);

  await prisma.$transaction(
    groups.map((g) =>
      prisma.whatsappGroup.upsert({
        where: { instanceId_remoteJid: { instanceId, remoteJid: g.JID } },
        create: { instanceId, remoteJid: g.JID, name: g.Name || g.JID, enabled: false },
        update: { name: g.Name || g.JID },
      }),
    ),
  );

  expire(TAGS.whatsapp);
  return groups.length;
}

export async function setGroupEnabled(groupId: string, enabled: boolean): Promise<void> {
  await prisma.whatsappGroup.update({ where: { id: groupId }, data: { enabled } });
  expire(TAGS.whatsapp);
}
