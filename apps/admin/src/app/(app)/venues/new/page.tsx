"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@one/ui";
import { Wizard } from "@/components/wizard/Wizard";

function WizardRoute() {
  const id = useSearchParams().get("id");
  return <Wizard key={id ?? "new"} venueId={id} />;
}

export default function NewVenuePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <WizardRoute />
    </Suspense>
  );
}
