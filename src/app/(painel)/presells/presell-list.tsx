import { headers } from "next/headers";
import { IconDocumento } from "@/components/icons";
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
        title="Nenhuma pre-sell criada ainda"
        description="Crie uma página de pre-sell pra aquecer o clique antes de mandar pro Mercado Livre."
        action={
          <Button render={<Link href="/presells/novo" />}>Nova pre-sell</Button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {presells.map((p) => (
        <PresellCard key={p.id} presell={p} publicHref={publicUrl(`/p/${p.slug}`, settings, requestHeaders)} />
      ))}
    </div>
  );
}
