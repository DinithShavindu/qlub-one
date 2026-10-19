"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Link2 } from "lucide-react";
import { EmptyState, ErrorState, Skeleton, formatDuration } from "@one/ui";
import { ButtonLink } from "@/components/ButtonLink";
import { FilterBar, SearchPill, TogglePill } from "@/components/FilterBar";
import { PageHeader } from "@/components/PageHeader";
import { VenueStatusPill } from "@/components/shell/VenueStatusPill";
import { FLOW_SHORT, VENUE_TYPE_LABEL } from "@/lib/format";
import { useVenues } from "@/lib/queries";

export default function VenuesPage() {
  const venues = useVenues();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "live" | "draft">("");
  const [kind, setKind] = useState<"" | "single" | "multi">("");
  const needle = q.trim().toLowerCase();
  const rows = (venues.data?.venues ?? []).filter(
    ({ venue }) =>
      (!status || venue.status === status) &&
      (!kind || (kind === "single") === (venue.type === "restaurant")) && (!needle || venue.name.toLowerCase().includes(needle) || venue.code.toLowerCase().includes(needle)),
  );
  return (
    <>
      <PageHeader
        title="Venues"
        subtitle="A restaurant is a single venue; a food court or hotel is a multivendor venue of restaurants working together."
        addHref="/onboard"
        addLabel="Onboard"
      />
      <FilterBar
        actions={
          <>
            <ButtonLink href="/restaurants/new" size="lg" variant="secondary" className="rounded-lg px-7">
              New restaurant
            </ButtonLink>
            <ButtonLink href="/venues/new" size="lg" className="rounded-lg px-7">
              New food court / hotel
            </ButtonLink>
          </>
        }
      >
        <SearchPill value={q} onChange={setQ} placeholder="Search venue name" />
        <TogglePill active={kind === ""} onClick={() => setKind("")}>
          All types
        </TogglePill>
        <TogglePill active={kind === "single"} onClick={() => setKind("single")}>
          Restaurants
        </TogglePill>
        <TogglePill active={kind === "multi"} onClick={() => setKind("multi")}>
          Multivendor
        </TogglePill>
        <span className="mx-1 h-8 w-px bg-line" aria-hidden />
        <TogglePill active={status === ""} onClick={() => setStatus("")}>
          Any status
        </TogglePill>
        <TogglePill active={status === "live"} onClick={() => setStatus("live")}>
          Live
        </TogglePill>
        <TogglePill active={status === "draft"} onClick={() => setStatus("draft")}>
          Draft
        </TogglePill>
      </FilterBar>
      <section className="overflow-x-auto rounded-2xl border border-line bg-surface pt-4">
        {venues.isPending ? (
          <div className="flex flex-col gap-3 p-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : venues.isError ? (
          <ErrorState title="Couldn't load venues" body={venues.error.message} retry={() => void venues.refetch()} />
        ) : venues.data.venues.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="No venues yet"
            body="Onboard your first food court — vendors, menus and table QRs in one flow."
            action={
<ButtonLink href="/venues/new">Start onboarding</ButtonLink>
            }
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Venue</th>
                <th>Code</th>
                <th>Type</th>
                <th>Flow</th>
                <th>Status</th>
                <th className="text-right">Vendors</th>
                <th className="text-right">Menu items</th>
                <th className="text-right">Tables</th>
                <th>Setup time</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-ink-muted">
                    No venues match these filters.
                  </td>
                </tr>
              )}
              {rows.map(({ venue, vendorCount, itemCount, tableCount }) => {
                const live = venue.status === "live";
                const href = live ? `/venues/${venue.id}` : venue.type === "restaurant" ? `/venues/${venue.id}/settings` : `/venues/new?id=${venue.id}`;
                return (
                  <tr key={venue.id}>
                    <td>
                      <Link href={href} className="inline-flex items-center gap-2 text-body font-semibold text-ink hover:underline">
                        <Link2 className="h-5 w-5 -rotate-45" aria-hidden />
                        {venue.name}
                      </Link>
                    </td>
                    <td className="font-mono text-ink-soft">{venue.code}</td>
                    <td className="text-body">{VENUE_TYPE_LABEL[venue.type]}</td>
                    <td className="text-body">{FLOW_SHORT[venue.flow]}</td>
                    <td>
                      <VenueStatusPill status={venue.status} />
                    </td>
                    <td className="text-right text-body tabular-nums">{vendorCount}</td>
                    <td className="text-right text-body tabular-nums">{itemCount}</td>
                    <td className="text-right text-body tabular-nums">{tableCount}</td>
                    <td className="text-body tabular-nums">{venue.setupDurationMs !== null ? formatDuration(venue.setupDurationMs) : "—"}</td>
                    <td className="text-right">
                      <Link href={href} className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-brand hover:underline">
                        {live ? "Open dashboard" : "Continue setup"}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
