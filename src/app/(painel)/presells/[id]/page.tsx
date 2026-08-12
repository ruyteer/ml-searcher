import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPresellForEdit, listEligibleLinks, listPreviewProducts } from "@/lib/data/presells";
import { PresellEditor } from "../presell-editor";
import { PresellEditorSkeleton } from "../skeletons";

interface EditPresellPageProps {
  params: Promise<{ id: string }>;
}

async function EditPresellForm({ id }: { id: string }) {
  const presell = await getPresellForEdit(id);
  if (!presell) notFound();

  const [eligibleLinks, previewProducts] = await Promise.all([
    listEligibleLinks(presell.id),
    listPreviewProducts(),
  ]);
  return (
    <PresellEditor
      mode="edit"
      presell={presell}
      eligibleLinks={eligibleLinks}
      previewProducts={previewProducts}
    />
  );
}

export default async function EditPresellPage({ params }: EditPresellPageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<PresellEditorSkeleton />}>
      <EditPresellForm id={id} />
    </Suspense>
  );
}
