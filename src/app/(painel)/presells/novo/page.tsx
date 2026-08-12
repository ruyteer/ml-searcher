import { Suspense } from "react";
import { listEligibleLinks } from "@/lib/data/presells";
import { PresellEditor } from "../presell-editor";
import { PresellEditorSkeleton } from "../skeletons";

async function NewPresellForm() {
  const eligibleLinks = await listEligibleLinks();
  return <PresellEditor mode="create" eligibleLinks={eligibleLinks} />;
}

export default function NewPresellPage() {
  return (
    <Suspense fallback={<PresellEditorSkeleton />}>
      <NewPresellForm />
    </Suspense>
  );
}
