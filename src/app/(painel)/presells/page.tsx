import { Suspense } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { IconAdicionar } from "@/components/icons";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { PresellList } from "./presell-list";
import { PresellGridSkeleton } from "./skeletons";

export default function PresellsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pre-sells"
        description="Modelos de página que aquecem o clique antes de mandar pro Mercado Livre. Um modelo atende quantos produtos você quiser: a foto, o nome e o preço saem do produto de cada link."
        actions={
          <Button render={<Link href="/presells/novo" />}>
            <HugeiconsIcon icon={IconAdicionar} size={16} strokeWidth={1.8} aria-hidden="true" /> Novo modelo
          </Button>
        }
      />

      <Suspense fallback={<PresellGridSkeleton />}>
        <PresellList />
      </Suspense>
    </div>
  );
}
