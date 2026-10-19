"use client";
import { cx } from "@/lib/cx";
import { useState } from "react";
import { useParams } from "next/navigation";
import { Info, Receipt } from "lucide-react";
import { EmptyState, ErrorState, MoneyText, Skeleton, VendorBadge } from "@one/ui";
import type { Vendor } from "@one/contracts";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { LedgerTable } from "@/components/venue/LedgerTable";
import { useSettlements, useVenue } from "@/lib/queries";

const select = "h-10 rounded-md border border-line bg-surface px-3 text-small font-semibold";

export default function SettlementsPage() {
  const { id } = useParams<{ id: string }>();
  const [vendorId, setVendorId] = useState("");
  const [type, setType] = useState("");
  const venue = useVenue(id);
  const q = useSettlements(id, vendorId, type);

  const header = (
    <>
      <PageHeader title="Settlements" subtitle={venue.data ? `${venue.data.venue.name} · what each vendor is owed` : undefined} />
      <p className="mb-6 flex items-center gap-3 rounded-md bg-status-prep px-4 py-3 text-small font-semibold text-status-prep-fg">
        <Info className="h-4 w-4 shrink-0" aria-hidden />
        Mock ledger — no money moves in this demo.
      </p>
    </>
  );

  if (q.isPending) {
    return (
      <>
        {header}
        <div className="mb-6 grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </>
    );
  }
  if (q.isError) {
    return (
      <>
        {header}
        <ErrorState title="Couldn't load the ledger" body={q.error.message} retry={() => void q.refetch()} />
      </>
    );
  }

  const s = q.data;
  const cur = s.currency;
  const tz = venue.data?.venue.timezone ?? "Asia/Dubai";
  const vendors = new Map<string, Vendor>(s.byVendor.map((b) => [b.vendor.id, b.vendor]));
  const filtered = !!vendorId || !!type;

  return (
    <>
      {header}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {s.byVendor.map((b) => (
          <section key={b.vendor.id} className="rounded-lg border border-line bg-surface p-4 shadow-card">
            <VendorBadge vendor={b.vendor} size="sm" />
            <dl className="mt-3 grid grid-cols-2 gap-y-1 text-small">
              <dt className="text-ink-muted">Gross</dt>
              <dd className="text-right">
                <MoneyText minor={b.grossMinor} currency={cur} />
              </dd>
              <dt className="text-ink-muted">qlub fee</dt>
              <dd className="text-right text-ink-soft">
                <MoneyText minor={b.feeMinor} currency={cur} />
              </dd>
              <dt className="font-semibold">Net payable</dt>
              <dd className="text-right font-display text-body font-bold">
                <MoneyText minor={b.netMinor} currency={cur} />
              </dd>
            </dl>
          </section>
        ))}
      </div>

      <Card
        title="Ledger"
        actions={
          <div className="flex items-center gap-3">
            <label className="sr-only" htmlFor="f-vendor">
              Filter by vendor
            </label>
            <select id="f-vendor" className={select} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">All vendors</option>
              {s.byVendor.map((b) => (
                <option key={b.vendor.id} value={b.vendor.id}>
                  {b.vendor.emoji} {b.vendor.name}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="f-type">
              Filter by type
            </label>
            <select id="f-type" className={select} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Sales &amp; reversals</option>
              <option value="sale">Sales</option>
              <option value="reversal">Reversals</option>
            </select>
          </div>
        }
      >
        {s.entries.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-8 w-8" />}
            title={filtered ? "No entries match these filters" : "No ledger entries yet"}
            body={filtered ? "Try another vendor or type." : "Each paid vendor order adds a sale; a failed one adds a reversal."}
          />
        ) : (
          <LedgerTable entries={s.entries} vendors={vendors} currency={cur} timezone={tz} />
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-surface-sunk px-5 py-3 text-small">
          <span className="text-ink-soft">
            All entries · gross <MoneyText minor={s.totals.grossMinor} currency={cur} className="font-semibold text-ink" /> · fees{" "}
            <MoneyText minor={s.totals.feeMinor} currency={cur} className="font-semibold text-ink" /> · vendor net{" "}
            <MoneyText minor={s.totals.netMinor} currency={cur} className="font-semibold text-ink" />
          </span>
          <span
            role="status"
            className={cx("font-display text-body font-bold", s.balanced ? "text-vendor-3" : "text-status-failed-fg")}
          >
            Σ vendor net + Σ fees = Σ gross {s.balanced ? "✓" : "✗"}
          </span>
        </div>
      </Card>
    </>
  );
}
