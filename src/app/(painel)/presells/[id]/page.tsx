import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPresellForEdit, listEligibleLinks } from "@/lib/data/presells";
import { PresellEditor } from "../presell-editor";
import { PresellEditorSkeleton } from "../skeletons";

interface EditPresellPageProps {
  params: Promise<{ id: string }>;
}

async function EditPresellForm({ id }: { id: string }) {
  const presell = await getPresellForEdit(id);
  if (!presell) notFound();

  const eligibleLinks = await listEligibleLinks(presell.id);
  return <PresellEditor mode="edit" presell={presell} eligibleLinks={eligibleLinks} />;
}

export default async function EditPresellPage({ params }: EditPresellPageProps) {
  const { id } = await params;
  return (
    <Suspense fallback={<PresellEditorSkeleton />}>
      <EditPresellForm id={id} />
    </Suspense>
  );
}
