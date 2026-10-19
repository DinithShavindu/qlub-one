"use client";
import Link from "next/link";
import { ArrowRight, Building2, Plus } from "lucide-react";
import { EmptyState, ErrorState, Skeleton, formatDuration } from "@one/ui";
import { ButtonLink } from "@/components/ButtonLink";
import { PageHeader } from "@/components/PageHeader";
import { VenueStatusPill } from "@/components/shell/VenueStatusPill";
import { useVenues } from "@/lib/queries";

export default function VenuesPage() {
  const venues = useVenues();
  return (
    <>
      <PageHeader
        title="Venues"
        subtitle="Each food court is one venue — one setup, one QR set, one settlement."
        actions={
          <ButtonLink href="/venues/new">
            <Plus className="h-4 w-4" aria-hidden /> New venue
          </ButtonLink>
        }
      />
      <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
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
          <table className="w-full text-left text-small">
            <thead className="border-b border-line bg-surface-sunk text-micro uppercase text-ink-muted">
              <tr>
                <th className="px-5 py-3 font-semibold">Venue</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Vendors</th>
                <th className="px-5 py-3 text-right font-semibold">Menu items</th>
                <th className="px-5 py-3 text-right font-semibold">Tables</th>
                <th className="px-5 py-3 font-semibold">Setup time</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {venues.data.venues.map(({ venue, vendorCount, itemCount, tableCount }) => {
                const live = venue.status === "live";
                const href = live ? `/venues/${venue.id}` : `/venues/new?id=${venue.id}`;
                return (
                  <tr key={venue.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-5 py-3">
                      <Link href={href} className="font-semibold text-ink hover:underline">
                        {venue.name}
                      </Link>
                      <p className="text-micro uppercase text-ink-muted">Code {venue.code}</p>
                    </td>
                    <td className="px-5 py-3">
                      <VenueStatusPill status={venue.status} />
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{vendorCount}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{itemCount}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{tableCount}</td>
                    <td className="px-5 py-3 tabular-nums">{venue.setupDurationMs !== null ? formatDuration(venue.setupDurationMs) : "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={href} className="inline-flex items-center gap-1 font-semibold text-brand-strong hover:underline">
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
