import { NextResponse } from "next/server";
import { getLatestRun, getRunProgress } from "@/lib/scraper/run";
import { toStatusPayload } from "../_lib";

export const dynamic = "force-dynamic";

/// Polling de progresso. ?runId=... é opcional — sem ele, devolve a
/// varredura mais recente (getLatestRun), útil pro painel abrir já
/// mostrando algo mesmo sem saber qual run está ativo.
export async function GET(request: Request) {
  const runId = new URL(request.url).searchParams.get("runId");

  const progress = runId ? await getRunProgress(runId) : await getLatestRun();
  if (!progress) {
    return NextResponse.json(
      { error: "Nenhuma varredura encontrada" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(toStatusPayload(progress), {
    headers: { "Cache-Control": "no-store" },
  });
}
