"use client";
import { useParams, usePathname, useSearchParams } from "next/navigation";

/** Venue id from `/venues/[id]/…` or the wizard's `?id=`. Must render under <Suspense>. */
export function useCurrentVenueId(): string | null {
  const params = useParams<{ id?: string }>();
  const pathname = usePathname();
  const search = useSearchParams();
  if (pathname.startsWith("/venues/new")) return search.get("id");
  return typeof params.id === "string" ? params.id : null;
}
