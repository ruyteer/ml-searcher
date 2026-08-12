import { Suspense } from "react";
import { listEligibleLinks, listPreviewProducts } from "@/lib/data/presells";
import { PresellEditor } from "../presell-editor";
import { PresellEditorSkeleton } from "../skeletons";

async function NewPresellForm() {
  const [eligibleLinks, previewProducts] = await Promise.all([
    listEligibleLinks(),
    listPreviewProducts(),
  ]);
  return (
    <PresellEditor mode="create" eligibleLinks={eligibleLinks} previewProducts={previewProducts} />
  );
}

export default function NewPresellPage() {
  return (
    <Suspense fallback={<PresellEditorSkeleton />}>
      <NewPresellForm />
    </Suspense>
  );
}
