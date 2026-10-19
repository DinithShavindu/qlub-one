"use client";
import { useRouter } from "next/navigation";
import { Skeleton } from "@one/ui";
import { useVenues } from "@/lib/queries";
import { useCurrentVenueId } from "./use-current-venue-id";
import { VenueStatusPill } from "./VenueStatusPill";

export function TopBar() {
  const router = useRouter();
  const venueId = useCurrentVenueId();
  const venues = useVenues();
  const current = venues.data?.venues.find((v) => v.venue.id === venueId)?.venue;

  function go(id: string) {
    const v = venues.data?.venues.find((x) => x.venue.id === id)?.venue;
    if (!v) return;
    router.push(v.status === "live" ? `/venues/${v.id}` : `/venues/new?id=${v.id}`);
  }

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-admin items-center gap-4 px-8">
        <label htmlFor="venue-switcher" className="text-small font-semibold text-ink-muted">
          Venue
        </label>
        {venues.isPending ? (
          <Skeleton className="h-10 w-72" />
        ) : (
          <select
            id="venue-switcher"
            value={current?.id ?? ""}
            onChange={(e) => go(e.target.value)}
            className="h-10 w-72 rounded-md border border-line bg-surface px-3 text-small font-semibold"
          >
            <option value="" disabled>
              {venues.isError ? "Couldn't load venues" : "Select a venue…"}
            </option>
            {venues.data?.venues.map(({ venue }) => (
              <option key={venue.id} value={venue.id}>
                {venue.name} · {venue.status === "live" ? "Live" : "Draft"}
              </option>
            ))}
          </select>
        )}
        {current && <VenueStatusPill status={current.status} />}
        {current && (
          <span className="ml-auto text-small text-ink-muted">
            Venue code <span className="font-display font-bold text-ink">{current.code}</span>
          </span>
        )}
      </div>
    </header>
  );
}
