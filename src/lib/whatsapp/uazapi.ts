import "server-only";

/// Cliente fino da Uazapi (https://docs.uazapi.com). Dois níveis de token:
/// `admintoken` (header) cria/lista instâncias; `token` (header) autentica
/// como UMA instância específica e é o que usamos pra conectar, listar
/// grupos e enviar mensagem. Endpoints e nomes de campo conferidos na spec
/// real da API (openapi-bundled.json), não deduzidos.

export class UazapiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
  ) {
    super(message);
    this.name = "UazapiError";
  }
}

function normalizeHost(host: string): string {
  return host.trim().replace(/\/+$/, "");
}

async function request<T>(
  host: string,
  path: string,
  headerName: "admintoken" | "token",
  headerValue: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  if (!host) throw new UazapiError("Uazapi: host não configurado", 0, path);
  if (!headerValue) throw new UazapiError("Uazapi: token não configurado", 0, path);

  const res = await fetch(`${normalizeHost(host)}${path}`, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      [headerName]: headerValue,
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const errorField =
      data && typeof data === "object" && "error" in data ? (data as { error: unknown }).error : undefined;
    const message = errorField ? String(errorField) : `Uazapi respondeu ${res.status} em ${path}`;
    throw new UazapiError(message, res.status, path);
  }

  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// -------------------------------------------------------------- admintoken

export interface UazapiInstance {
  id: string;
  name: string;
  token: string;
  status: "disconnected" | "connecting" | "connected" | "hibernated";
  qrcode?: string;
  paircode?: string;
  profileName?: string;
  profilePicUrl?: string;
  owner?: string;
}

export async function createInstance(
  host: string,
  adminToken: string,
  name: string,
): Promise<UazapiInstance> {
  const data = await request<{ instance?: UazapiInstance; token?: string; name?: string }>(
    host,
    "/instance/create",
    "admintoken",
    adminToken,
    { body: { name } },
  );
  // A API devolve o token tanto solto quanto dentro de `instance`; cobre os dois.
  return { ...data.instance, token: data.instance?.token ?? data.token ?? "", name: data.instance?.name ?? name } as UazapiInstance;
}

export async function listInstances(host: string, adminToken: string): Promise<UazapiInstance[]> {
  return request<UazapiInstance[]>(host, "/instance/all", "admintoken", adminToken, { method: "GET" });
}

// -------------------------------------------------------------------- token

export interface ConnectResult {
  instance: UazapiInstance;
}

/// Sem `phone`: gera QR code. Com `phone`: gera código de pareamento.
export async function connectInstance(
  host: string,
  token: string,
  phone?: string,
): Promise<ConnectResult> {
  return request<ConnectResult>(host, "/instance/connect", "token", token, {
    body: phone ? { phone } : {},
  });
}

export interface InstanceStatus {
  instance: UazapiInstance;
  status: {
    connected: boolean;
    loggedIn: boolean;
    jid: { user?: string } | null;
  };
}

export async function getInstanceStatus(host: string, token: string): Promise<InstanceStatus> {
  return request<InstanceStatus>(host, "/instance/status", "token", token, { method: "GET" });
}

export async function disconnectInstance(host: string, token: string): Promise<void> {
  await request(host, "/instance/disconnect", "token", token, { body: {} });
}

export interface UazapiGroup {
  JID: string;
  Name: string;
}

/// `force` busca direto do WhatsApp em vez do cache da Uazapi.
export async function listGroups(host: string, token: string, force = false): Promise<UazapiGroup[]> {
  const data = await request<{ groups: UazapiGroup[] }>(
    host,
    `/group/list${force ? "?force=true" : ""}`,
    "token",
    token,
    { method: "GET" },
  );
  return data.groups ?? [];
}

export interface SendTextInput {
  /// JID do destino: número (5511999999999) ou grupo (...@g.us).
  number: string;
  text: string;
  linkPreview?: boolean;
  linkPreviewTitle?: string;
  linkPreviewDescription?: string;
  linkPreviewImage?: string;
  linkPreviewLarge?: boolean;
  delay?: number;
}

export async function sendText(host: string, token: string, input: SendTextInput): Promise<void> {
  await request(host, "/send/text", "token", token, { body: input });
}

export interface SendMediaInput {
  /// JID do destino: número (5511999999999) ou grupo (...@g.us).
  number: string;
  /// URL pública da mídia (a Uazapi baixa e reenvia).
  media: string;
  type: "image" | "video" | "videoplay" | "ptv" | "audio" | "myaudio" | "ptt";
  caption?: string;
  delay?: number;
}

export async function sendMedia(host: string, token: string, input: SendMediaInput): Promise<void> {
  await request(host, "/send/media", "token", token, { body: input });
}
