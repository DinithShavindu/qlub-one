import { Suspense } from "react";
import { MenuScreen } from "@/components/MenuScreen";
import { MenuSkeleton } from "@/components/MenuSkeleton";

export default function MenuPage({ params }: { params: { venueId: string } }) {
  return (
    <Suspense fallback={<MenuSkeleton />}>
      <MenuScreen venueId={params.venueId} />
    </Suspense>
  );
}
