import { Suspense } from "react";
import { MenuScreen } from "@/components/MenuScreen";
import { MenuSkeleton } from "@/components/MenuSkeleton";

export default function VendorMenuPage({ params }: { params: { venueId: string; vendorSlug: string } }) {
  return (
    <Suspense fallback={<MenuSkeleton />}>
      <MenuScreen venueId={params.venueId} vendorSlug={params.vendorSlug} />
    </Suspense>
  );
}
