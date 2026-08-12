import "server-only";
import { cookies } from "next/headers";

const COOKIE = "mls_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function secret() {
  const s = process.env.APP_PASSWORD;
  if (!s) throw new Error("APP_PASSWORD não configurada");
  return s;
}

/// Assinatura HMAC do valor fixo "ok". Sem estado no servidor: se o cookie
/// bate com o HMAC da senha atual, a sessão é válida. Trocar APP_PASSWORD
/// invalida todas as sessões automaticamente.
async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Buffer.from(sig).toString("base64url");
}

export async function createSession() {
  const token = await sign("ok");
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  try {
    return token === (await sign("ok"));
  } catch {
    return false;
  }
}

export function checkPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected) return false;
  // comparação de tempo constante
  const a = new TextEncoder().encode(input);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export { COOKIE as SESSION_COOKIE };
