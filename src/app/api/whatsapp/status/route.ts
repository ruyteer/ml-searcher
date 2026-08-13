import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { refreshInstanceStatus } from "@/lib/whatsapp/instance";
import { Prisma } from "@/generated/prisma";

export const dynamic = "force-dynamic";

/// Polling da tela de conexão: consulta o status ao vivo (com QR code
/// atualizado enquanto conecta). Protegido pela mesma sessão do painel — o
/// QR code deixa qualquer WhatsApp assumir a instância, não pode vazar.
export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const instanceId = new URL(request.url).searchParams.get("instanceId");
  if (!instanceId) {
    return NextResponse.json({ error: "instanceId é obrigatório" }, { status: 400 });
  }

  try {
    const result = await refreshInstanceStatus(instanceId);
    return NextResponse.json(
      {
        status: result.instance.status,
        qrcode: result.instance.qrcode ?? null,
        paircode: result.instance.paircode ?? null,
        connected: result.status.connected,
        profileName: result.instance.profileName ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : "Falha ao consultar status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
