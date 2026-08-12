import { NextResponse, after, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerClick } from "@/lib/links";
import { LinkKind } from "@/generated/prisma";

export const dynamic = "force-dynamic";

/// Extrai o IP real por trás de proxy/CDN. x-forwarded-for pode trazer uma
/// lista "cliente, proxy1, proxy2" — o primeiro é o cliente.
function extractIp(request: NextRequest): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

function extractCountry(request: NextRequest): string | null {
  return (
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    null
  );
}

/// 302 sem cache algum — o visitante nunca deve ver uma resposta velha.
function redirectNoStore(destination: string, request: NextRequest): NextResponse {
  const url = /^https?:\/\//i.test(destination)
    ? destination
    : new URL(destination, request.url);
  const res = NextResponse.redirect(url, { status: 302 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const link = await prisma.link.findUnique({
    where: { slug },
    include: { presell: true },
  });

  // slug inexistente ou link desativado — nunca mostra erro feio, manda pra home
  if (!link || !link.active) {
    return redirectNoStore("/", request);
  }

  const destination =
    link.kind === LinkKind.PRESELL && link.presell
      ? `/p/${link.presell.slug}`
      : link.targetUrl;

  const clickInput = {
    ip: extractIp(request),
    userAgent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
    country: extractCountry(request),
  };

  // dispara a gravação do clique sem bloquear o redirect — latência aqui é
  // dinheiro. `after` roda depois da resposta já ter sido enviada.
  after(() =>
    registerClick(link.id, clickInput).catch((err) => {
      console.error("registerClick falhou", err);
    }),
  );

  return redirectNoStore(destination, request);
}
