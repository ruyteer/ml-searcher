import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { FrasesTabs } from "./frases-tabs";
import { PhrasesTabContent } from "./phrases-tab-content";
import { TemplatesTabContent } from "./templates-tab-content";
import { PhrasesTabSkeleton, TemplatesTabSkeleton } from "./skeletons";

export default function FrasesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Frases"
        description="Banco de frases e templates usados para montar as mensagens enviadas aos grupos de WhatsApp."
      />
      <FrasesTabs
        frasesSlot={
          <Suspense fallback={<PhrasesTabSkeleton />}>
            <PhrasesTabContent />
          </Suspense>
        }
        templatesSlot={
          <Suspense fallback={<TemplatesTabSkeleton />}>
            <TemplatesTabContent />
          </Suspense>
        }
      />
    </div>
  );
}
