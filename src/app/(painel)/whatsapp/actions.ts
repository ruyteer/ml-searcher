"use server";

import { z } from "zod";
import { setSettings } from "@/lib/settings";
import { TAGS, bust } from "@/lib/cache";
import {
  createAndSaveInstance,
  connectInstance,
  disconnectInstance,
  syncGroups,
  setGroupEnabled,
  WhatsappConfigError,
} from "@/lib/whatsapp/instance";
import { UazapiError } from "@/lib/whatsapp/uazapi";
import {
  type ActionState,
  type InstanceActionState,
  ok,
  fail,
  okInstance,
  failInstance,
} from "./action-state";

function errorMessage(err: unknown): string {
  if (err instanceof WhatsappConfigError) return err.message;
  if (err instanceof UazapiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Algo deu errado.";
}

// ---------------------------------------------------------------- instância

export async function createInstanceAction(
  _prev: InstanceActionState,
  formData: FormData,
): Promise<InstanceActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return failInstance("Digite um nome para a instância.");
  if (name.length > 60) return failInstance("Nome muito longo.");

  try {
    const instance = await createAndSaveInstance(name);
    await connectInstance(instance.id);
    return okInstance("Instância criada. Escaneie o QR code pra conectar.", instance.id);
  } catch (err) {
    return failInstance(errorMessage(err));
  }
}

export async function reconnectAction(instanceId: string): Promise<InstanceActionState> {
  try {
    await connectInstance(instanceId);
    return okInstance("Gerando um novo QR code...", instanceId);
  } catch (err) {
    return failInstance(errorMessage(err));
  }
}

export async function disconnectAction(instanceId: string): Promise<ActionState> {
  try {
    await disconnectInstance(instanceId);
    return ok("Instância desconectada.");
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function syncGroupsAction(instanceId: string): Promise<ActionState> {
  try {
    const total = await syncGroups(instanceId);
    return ok(`${total} grupo(s) sincronizado(s) da conta conectada.`);
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function toggleGroupAction(groupId: string, enabled: boolean): Promise<ActionState> {
  try {
    await setGroupEnabled(groupId, enabled);
    return ok(enabled ? "Grupo habilitado pra receber ofertas." : "Grupo desabilitado.");
  } catch (err) {
    return fail(errorMessage(err));
  }
}

// ---------------------------------------------------------------- uazapi

const uazapiSchema = z.object({
  uazapiHost: z
    .string()
    .trim()
    .min(1, "Informe o host da Uazapi.")
    .refine((v) => /^https?:\/\//.test(v), "O host precisa começar com http:// ou https://"),
  uazapiAdminToken: z.string().trim().max(500).optional(),
});

export async function saveUazapiConfigAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = uazapiSchema.safeParse({
    uazapiHost: formData.get("uazapiHost"),
    uazapiAdminToken: formData.get("uazapiAdminToken") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const patch: Record<string, string> = { uazapiHost: parsed.data.uazapiHost.replace(/\/+$/, "") };
  // Campo em branco = mantém o token salvo (nunca reexibido), igual ao App
  // Secret do Mercado Livre.
  if (parsed.data.uazapiAdminToken) patch.uazapiAdminToken = parsed.data.uazapiAdminToken;

  await setSettings(patch);
  return ok("Configuração da Uazapi salva.");
}

// --------------------------------------------------------------- agendamento

const scheduleSchema = z
  .object({
    whatsappEnabled: z.coerce.boolean(),
    whatsappIntervalMinutes: z.coerce.number().int().min(5, "Mínimo de 5 minutos.").max(1440, "Máximo de 24 horas."),
    whatsappMinPerCycle: z.coerce.number().int().min(1, "Mínimo de 1 oferta."),
    whatsappMaxPerCycle: z.coerce.number().int().min(1, "Mínimo de 1 oferta."),
    whatsappUsePresell: z.coerce.boolean(),
    whatsappPresellId: z.string().trim().optional().default(""),
  })
  .refine((v) => v.whatsappMaxPerCycle >= v.whatsappMinPerCycle, {
    message: "O máximo não pode ser menor que o mínimo.",
    path: ["whatsappMaxPerCycle"],
  });

export async function saveScheduleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = scheduleSchema.safeParse({
    whatsappEnabled: formData.get("whatsappEnabled") === "true",
    whatsappIntervalMinutes: formData.get("whatsappIntervalMinutes"),
    whatsappMinPerCycle: formData.get("whatsappMinPerCycle"),
    whatsappMaxPerCycle: formData.get("whatsappMaxPerCycle"),
    whatsappUsePresell: formData.get("whatsappUsePresell") === "true",
    whatsappPresellId:
      (formData.get("whatsappPresellId") as string | null) === "__default__"
        ? ""
        : formData.get("whatsappPresellId") || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  await setSettings(parsed.data);
  bust(TAGS.whatsapp);
  return ok(parsed.data.whatsappEnabled ? "Envio automático ativado." : "Envio automático desativado.");
}
