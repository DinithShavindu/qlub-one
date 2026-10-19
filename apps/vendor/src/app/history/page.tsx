"use client";
import { ClipboardList } from "lucide-react";
import type { VendorMeResponse } from "@one/contracts";
import { EmptyState, ErrorState, formatMoney, Skeleton, StatTile } from "@one/ui";
import { AuthGate } from "@/components/AuthGate";
import { HistoryTable } from "@/components/HistoryTable";
import { PageHeader } from "@/components/PageHeader";
import { useHistory } from "@/lib/queries";

export default function HistoryPage() {
  return <AuthGate>{(me) => <History me={me} />}</AuthGate>;
}

function History({ me }: { me: VendorMeResponse }) {
  const q = useHistory();
  return (
    <div className="min-h-dvh">
      <PageHeader me={me} title="Today's history" />
      <main className="flex flex-col gap-6 p-4 md:p-6">
        {q.isPending ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-80 rounded-lg" />
          </>
        ) : q.isError ? (
          <ErrorState title="Couldn't load today's history" retry={() => void q.refetch()} />
        ) : (
          <>
            <section aria-label="Today's totals" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Orders" value={q.data.totals.orders} hint="Collected today" />
              <StatTile label="Gross" value={formatMoney(q.data.totals.grossMinor, q.data.currency)} hint="Your items' subtotal" />
              <StatTile label="qlub fee" value={formatMoney(q.data.totals.feeMinor, q.data.currency)} />
              <StatTile label="Net" value={formatMoney(q.data.totals.netMinor, q.data.currency)} hint="Owed to you (mock ledger)" emphasis />
            </section>
            {q.data.vendorOrders.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-10 w-10" />}
                title="No completed orders yet today"
                body="Orders appear here once they're collected."
              />
            ) : (
              <HistoryTable orders={q.data.vendorOrders} timezone={me.venue.timezone} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
