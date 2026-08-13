import { NextResponse } from "next/server";
import { runWhatsappCycle } from "@/lib/whatsapp/send";
import { cronSecretConfigured, isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/// Disparado por um agendador externo (a cada poucos minutos): o próprio
/// ciclo decide se já é hora de mandar o próximo lote, com base no intervalo
/// configurado em /whatsapp. Reaproveita a mesma varredura usada em
/// /api/cron/scrape quando as ofertas disponíveis se esgotam.
async function handle(request: Request): Promise<Response> {
  if (!cronSecretConfigured()) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await runWhatsappCycle(request.headers);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/whatsapp-send] falha no ciclo de envio:", err);
    return NextResponse.json({ error: "Falha no ciclo de envio" }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
