import { headers } from "next/headers";
import { IconDocumento, IconAlerta } from "@/components/icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { listPresells } from "@/lib/data/presells";
import { getSettings } from "@/lib/settings";
import { publicUrl } from "@/lib/links";
import { PresellCard } from "./presell-card";

export async function PresellList() {
  const [presells, settings, requestHeaders] = await Promise.all([
    listPresells(),
    getSettings(),
    headers(),
  ]);

  if (presells.length === 0) {
    return (
      <EmptyState
        icon={IconDocumento}
        title="Nenhum modelo criado ainda"
        description="Crie um modelo de página de aquecimento e reaproveite ele em quantos produtos quiser."
        action={<Button render={<Link href="/presells/novo" />}>Novo modelo</Button>}
      />
    );
  }

  // publicUrl("") devolve só a origem, que é o que a janela de links usa pra
  // montar o endereço de cada link do modelo.
  const publicBase = publicUrl("", settings, requestHeaders).replace(/\/$/, "");
  const semPadrao = presells.every((p) => !p.isDefault);

  return (
    <div className="flex flex-col gap-4">
      {semPadrao && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-sm text-warning">
          <HugeiconsIcon
            icon={IconAlerta}
            size={18}
            strokeWidth={1.6}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <p>
            Nenhum modelo está marcado como padrão. Marque um para poder gerar links com página de
            aquecimento sem precisar escolher o modelo toda vez.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {presells.map((p) => (
          <PresellCard
            key={p.id}
            presell={p}
            publicHref={publicUrl(`/p/${p.slug}`, settings, requestHeaders)}
            publicBase={publicBase}
          />
        ))}
      </div>
    </div>
  );
}
