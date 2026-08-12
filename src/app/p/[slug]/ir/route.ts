import { NextResponse, after, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerClick } from "@/lib/links";

export const dynamic = "force-dynamic";

// Saída da página de aquecimento. O botão final aponta para cá em vez de /r,
// porque /r devolveria um link "com página de aquecimento" para a própria
// página, criando um laço. Aqui o clique é contabilizado no mesmo Link e o
// visitante segue direto para o destino final.

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
    request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry") ?? null
  );
}

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

  const link = await prisma.link.findUnique({ where: { slug } });

  // endereço inexistente ou desligado — nunca mostra erro feio, manda pra home
  if (!link || !link.active) return redirectNoStore("/", request);

  const clickInput = {
    ip: extractIp(request),
    userAgent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
    country: extractCountry(request),
  };

  // grava o clique depois da resposta já ter saído — latência aqui é dinheiro.
  after(() =>
    registerClick(link.id, clickInput).catch((err) => {
      console.error("registerClick falhou", err);
    }),
  );

  return redirectNoStore(link.targetUrl, request);
}
