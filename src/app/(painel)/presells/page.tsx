import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { PresellList } from "./presell-list";
import { PresellGridSkeleton } from "./skeletons";

export default function PresellsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pre-sells"
        description="Páginas intermediárias que aquecem o clique antes de mandar pro Mercado Livre."
        actions={
          <Button render={<Link href="/presells/novo" />}>
            <Plus /> Nova pre-sell
          </Button>
        }
      />

      <Suspense fallback={<PresellGridSkeleton />}>
        <PresellList />
      </Suspense>
    </div>
  );
}
