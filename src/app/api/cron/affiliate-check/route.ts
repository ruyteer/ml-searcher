import { NextResponse } from "next/server";
import { runAffiliateCheckCycle } from "@/lib/ml/affiliate-check-cycle";
import { cronSecretConfigured, isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/// Disparado por um agendador externo (a cada poucos minutos): o próprio
/// ciclo decide se já é hora de validar o próximo lote de produtos pendentes
/// no programa de afiliados, igual /api/cron/whatsapp-send decide o envio.
async function handle(request: Request): Promise<Response> {
  if (!cronSecretConfigured()) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await runAffiliateCheckCycle();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/affiliate-check] falha no ciclo de checagem:", err);
    return NextResponse.json({ error: "Falha no ciclo de checagem" }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
