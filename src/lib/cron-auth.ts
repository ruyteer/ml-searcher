import "server-only";

/// Comparação em tempo constante — mesmo padrão de src/lib/auth.ts.
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

/// Autoriza uma rota /api/cron/*: Bearer ou header x-cron-secret, comparado
/// contra CRON_SECRET. Sem o secret configurado, nunca autoriza.
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (bearer && timingSafeEqual(bearer, secret)) return true;

  const altHeader = request.headers.get("x-cron-secret") ?? "";
  if (altHeader && timingSafeEqual(altHeader, secret)) return true;

  return false;
}

export function cronSecretConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET);
}
