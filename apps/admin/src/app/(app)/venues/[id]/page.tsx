"use client";
import { useParams } from "next/navigation";
import { AlertTriangle, Inbox, Receipt, Store } from "lucide-react";
import { EmptyState, ErrorState, MoneyText, Skeleton, StatTile, StatusChip, VendorBadge, formatDuration, formatMoney, formatTime, formatTimeAgo } from "@one/ui";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { ButtonLink } from "@/components/ButtonLink";
import { DraftBanner } from "@/components/venue/DraftBanner";
import { VendorTable } from "@/components/venue/VendorTable";
import { baselineLine, formatPrep } from "@/lib/format";
import { useDashboard } from "@/lib/queries";

export default function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const q = useDashboard(id);

  if (q.isPending) {
    return (
      <>
        <Skeleton className="mb-6 h-10 w-80" />
        <div className="mb-6 grid grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </>
    );
  }
  if (q.isError) return <ErrorState title="Couldn't load the dashboard" body={q.error.message} retry={() => void q.refetch()} />;

  const d = q.data;
  const vendorsById = new Map(d.byVendor.map((r) => [r.vendor.id, r.vendor]));
  const cur = d.currency;
  const tz = d.venue.timezone;

  return (
    <>
      {d.venue.status === "draft" && <DraftBanner venueId={id} />}
      <PageHeader
        title={d.venue.name}
        subtitle={`Today in ${tz} · refreshes every 5s${q.isRefetchError ? " · connection lost, retrying…" : ""}`}
        actions={
          <ButtonLink href={`/venues/${id}/settlements`} variant="secondary">
            <Receipt className="h-4 w-4" aria-hidden /> Settlement ledger
          </ButtonLink>
        }
      />

      <div className="mb-6 grid grid-cols-5 gap-4">
        <StatTile label="Orders today" value={d.ordersToday} hint="Paid guest baskets" />
        <StatTile label="GMV today" value={formatMoney(d.gmvMinor, cur)} hint="From the ledger" />
        <StatTile label="Avg prep time" value={formatPrep(d.avgPrepSeconds)} hint="Order → Ready" />
        <StatTile label="Active vendors" value={`${d.activeVendors} / ${d.totalVendors}`} hint="Open for orders" />
        <StatTile
          emphasis
          label="Setup time"
          value={d.setupDurationMs !== null ? formatDuration(d.setupDurationMs) : "In setup"}
          delta={d.setupDurationMs !== null ? baselineLine(d.totalVendors, d.baselineMinPerVendor) : undefined}
          className="[&>p:nth-child(2)]:text-h1"
        />
      </div>

      <Card title="By vendor" className="mb-6">
        {d.byVendor.length === 0 ? (
          <EmptyState icon={<Store className="h-8 w-8" />} title="No vendors yet" body="Add vendors in the onboarding wizard." />
        ) : (
          <VendorTable rows={d.byVendor} currency={cur} venueId={id} />
        )}
      </Card>

      <div className="grid grid-cols-3 gap-6">
        <Card title="Live orders" className="col-span-2">
          {d.recentOrders.length === 0 ? (
            <EmptyState icon={<Inbox className="h-8 w-8" />} title="No orders yet today" body="New vendor orders appear here within 5 seconds." />
          ) : (
            <ul className="divide-y divide-line" aria-live="polite">
              {d.recentOrders.map((o) => {
                const v = vendorsById.get(o.vendorId);
                return (
                  <li key={o.id} className="flex items-center gap-4 px-5 py-2.5 text-small">
                    <span className="w-14 font-display font-bold tabular-nums">{o.pickupCode}</span>
                    <span className="w-44 min-w-0">{v ? <VendorBadge vendor={v} size="sm" /> : "Vendor"}</span>
                    <span className="w-12 text-ink-muted">{o.tableLabel}</span>
                    <span className="flex-1 truncate text-ink-soft">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</span>
                    <MoneyText minor={o.subtotalMinor} currency={cur} className="w-24 text-right" />
                    <StatusChip status={o.status} className="w-28 justify-center" />
                    <span className="w-16 text-right text-ink-muted" title={formatTime(o.createdAt, tz)}>
                      {formatTimeAgo(o.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title={`Failures${d.failures.length ? ` · ${d.failures.length}` : ""}`}>
          {d.failures.length === 0 ? (
            <EmptyState title="No failed vendor orders today" body="If a vendor's POS rejects an order, the guest is refunded for that part and it shows here." />
          ) : (
            <ul className="divide-y divide-line">
              {d.failures.map((o) => {
                const v = vendorsById.get(o.vendorId);
                return (
                  <li key={o.id} className="flex flex-col gap-1 px-5 py-3 text-small">
                    <div className="flex items-center justify-between gap-2">
                      {v ? <VendorBadge vendor={v} size="sm" /> : <span>Vendor</span>}
                      <span className="text-ink-muted">{formatTime(o.createdAt, tz)}</span>
                    </div>
                    <p className="flex items-start gap-1.5 text-status-failed-fg">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      {o.failureReason ?? "Order failed"}
                    </p>
                    <p className="text-ink-soft">
                      {o.tableLabel} · {o.pickupCode} · refunded <MoneyText minor={o.refundedMinor} currency={cur} className="font-semibold text-ink" />
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
