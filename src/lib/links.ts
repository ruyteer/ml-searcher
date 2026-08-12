import "server-only";
import { customAlphabet } from "nanoid";
import { prisma } from "./prisma";
import { getSettings, type Settings } from "./settings";
import { Prisma, LinkKind, type Link } from "@/generated/prisma";
import { TAGS, expire } from "./cache";

// ------------------------------------------------------------- affiliate url

/// Alfabeto sem caracteres ambíguos (sem 0/O, 1/l/I) — slugs fáceis de digitar/ler.
const SLUG_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const SLUG_SIZE = 8;
const generateSlug = customAlphabet(SLUG_ALPHABET, SLUG_SIZE);

/// Clique repetido do mesmo ipHash dentro desta janela conta como duplicado.
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

export interface AffiliateResult {
  url: string;
  /// true quando a URL saiu com a tag de afiliado aplicada.
  affiliate: boolean;
}

/// Acrescenta os parâmetros de rastreio do programa de afiliados do Mercado
/// Livre (matt_tool / matt_word), preservando a querystring já existente.
/// Sem affiliateEnabled/affiliateTool, devolve o permalink cru.
export function buildAffiliateUrl(
  permalink: string,
  settings: Pick<Settings, "affiliateEnabled" | "affiliateTool" | "affiliateWord">,
): AffiliateResult {
  const tool = settings.affiliateTool?.trim();
  if (!settings.affiliateEnabled || !tool) {
    return { url: permalink, affiliate: false };
  }

  try {
    const url = new URL(permalink);
    url.searchParams.set("matt_tool", tool);
    const word = settings.affiliateWord?.trim();
    if (word) url.searchParams.set("matt_word", word);
    return { url: url.toString(), affiliate: true };
  } catch {
    // permalink inválido — devolve cru em vez de quebrar o fluxo
    return { url: permalink, affiliate: false };
  }
}

// ------------------------------------------------------------------ public url

/// Monta a URL pública absoluta para `path`. Usa settings.publicBaseUrl quando
/// preenchido; senão deriva do host/proto da própria request (o usuário está
/// no domínio do Railway hoje e vai trocar depois — nada fica fixo no código).
export function publicUrl(
  path: string,
  settings: Pick<Settings, "publicBaseUrl">,
  requestHeaders?: Headers,
): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  const base = settings.publicBaseUrl?.trim().replace(/\/+$/, "");
  if (base) return `${base}${cleanPath}`;

  if (requestHeaders) {
    const host =
      requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
    if (host) {
      const proto =
        requestHeaders.get("x-forwarded-proto") ??
        (host.startsWith("localhost") || host.startsWith("127.0.0.1")
          ? "http"
          : "https");
      return `${proto}://${host}${cleanPath}`;
    }
  }

  // sem base configurada e sem headers de request — melhor devolver relativo
  // do que inventar um domínio.
  return cleanPath;
}

// --------------------------------------------------------------------- slug

// Faixa Unicode das marcas diacríticas combinantes (acentos), construída via
// charCode em vez de um literal \u no código-fonte para evitar problemas de
// codificação em alguns editores/terminais.
const DIACRITICS_RE = new RegExp(
  "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
  "g",
);

/// kebab-case sem acentos, usado nos slugs de pre-sell.
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(DIACRITICS_RE, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isUniqueSlugConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    Array.isArray(err.meta?.target) &&
    (err.meta?.target as string[]).includes("slug")
  );
}

// -------------------------------------------------------------- create link

export interface CreateLinkInput {
  productId?: string | null;
  kind?: LinkKind;
  presellId?: string | null;
  label?: string | null;
  /// Quando ausente, é resolvido a partir do produto + tag de afiliado.
  targetUrl?: string;
}

const MAX_SLUG_ATTEMPTS = 5;

/// Gera um slug curto e único, resolve o destino final e persiste o Link.
/// Colisão de slug é tratada com retry (o alfabeto de 8 chars praticamente
/// nunca colide, mas o retry cobre o caso raro).
export async function createLink(input: CreateLinkInput): Promise<Link> {
  const kind = input.kind ?? LinkKind.TRACKED;

  let targetUrl = input.targetUrl?.trim();
  let affiliate = false;

  if (!targetUrl) {
    if (!input.productId) {
      throw new Error(
        "createLink: informe targetUrl ou productId para resolver o destino",
      );
    }
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
    });
    if (!product) {
      throw new Error(`createLink: produto ${input.productId} não encontrado`);
    }
    const settings = await getSettings();
    const resolved = buildAffiliateUrl(product.permalink, settings);
    targetUrl = resolved.url;
    affiliate = resolved.affiliate;
  }

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = generateSlug();
    try {
      const link = await prisma.link.create({
        data: {
          slug,
          kind,
          label: input.label ?? null,
          productId: input.productId ?? null,
          presellId: input.presellId ?? null,
          targetUrl,
          affiliate,
        },
      });
      expire(TAGS.links);
      return link;
    } catch (err) {
      const lastAttempt = attempt === MAX_SLUG_ATTEMPTS - 1;
      if (isUniqueSlugConflict(err) && !lastAttempt) continue;
      throw err;
    }
  }

  // inatingível (o loop sempre retorna ou lança), só pra satisfazer o TS
  throw new Error("createLink: não foi possível gerar um slug único");
}

// ------------------------------------------------------------ register click

export interface RegisterClickInput {
  ip?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  country?: string | null;
}

export type Device = "mobile" | "tablet" | "desktop" | "bot";

/// Detecção simples de device por user-agent — o bastante pra segmentar
/// métricas, não precisa ser perfeita.
export function detectDevice(userAgent?: string | null): Device {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();

  if (
    /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|telegrambot|slurp|bingpreview|preview/.test(
      ua,
    )
  ) {
    return "bot";
  }
  if (/ipad|tablet|playbook|silk/.test(ua) && !/mobile/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|windows phone/.test(ua)) return "mobile";
  if (/android/.test(ua)) return /mobile/.test(ua) ? "mobile" : "tablet";
  return "desktop";
}

/// Hash SHA-256 do IP com salt de env — nunca guardamos o IP cru.
async function hashIp(ip: string): Promise<string> {
  const salt = process.env.IP_HASH_SALT ?? "";
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(digest).toString("hex");
}

/// Grava o Click e incrementa Link.clickCount na mesma transação. Marca
/// `duplicate` quando o mesmo ipHash já clicou neste link nos últimos 30min.
export async function registerClick(
  linkId: string,
  input: RegisterClickInput,
): Promise<void> {
  const ipHash = input.ip ? await hashIp(input.ip) : null;
  const device = detectDevice(input.userAgent);

  const duplicate = ipHash
    ? (await prisma.click.count({
        where: {
          linkId,
          ipHash,
          createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
        },
      })) > 0
    : false;

  await prisma.$transaction([
    prisma.click.create({
      data: {
        linkId,
        ipHash,
        userAgent: input.userAgent ?? null,
        referer: input.referer ?? null,
        country: input.country ?? null,
        device,
        duplicate,
      },
    }),
    prisma.link.update({
      where: { id: linkId },
      data: { clickCount: { increment: 1 } },
    }),
  ]);

  // Cliques repetidos não movem os números do painel, então não custeiam
  // uma invalidação de cache.
  if (!duplicate) expire(TAGS.clicks);
}
