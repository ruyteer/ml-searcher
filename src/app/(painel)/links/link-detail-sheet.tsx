"use client";

import { useQueryState } from "nuqs";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { linksSearchParams } from "./search-params";

/// Controla a abertura do Sheet pelo parâmetro `linkId` da URL — o conteúdo
/// (children) já vem renderizado pelo servidor, com seu próprio Suspense.
export function LinkDetailSheet({ children }: { children?: React.ReactNode }) {
  const [linkId, setLinkId] = useQueryState("linkId", linksSearchParams.linkId);

  return (
    <Sheet
      open={Boolean(linkId)}
      onOpenChange={(open) => {
        if (!open) setLinkId(null);
      }}
    >
      <SheetContent className="flex flex-col gap-4 overflow-hidden p-0 sm:max-w-md">
        {children}
      </SheetContent>
    </Sheet>
  );
}
