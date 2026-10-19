"use client";
import Link from "next/link";
import { ArrowRight, Bell, CheckCircle, ChefHat } from "lucide-react";
import { EmptyState, ErrorState, formatMoney, formatTime, Skeleton, StatTile, StatusChip, VendorBadge } from "@one/ui";
import { PanelPage } from "@/components/shell/PanelShell";
import { Panel, VendorCell } from "@/components/panel/ui";
import { usePanel } from "@/lib/panel";
import { useDashboard } from "@/lib/queries";

const fmtPrep = (s: number | null) => (s === null ? "—" : s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`);

export default function DashboardPage() {
  const { me, isManager, vendor } = usePanel();
  const q = useDashboard();
  const many = isManager && !vendor;

  return (
    <PanelPage title="Dashboard" subtitle={many ? `${me.venue.name} · all ${me.vendors.length} vendors · today` : `${vendor?.name ?? ""} · today`}>
      {q.isPending ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </>
      ) : q.isError ? (
        <ErrorState title="Couldn't load the dashboard" body={q.error.message} retry={() => void q.refetch()} />
      ) : (
        <>
          <section aria-label="Today" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatTile label="Orders today" value={q.data.today.orders} />
            <StatTile label="Gross sales" value={formatMoney(q.data.today.grossMinor, q.data.currency)} emphasis />
            <StatTile label="Net to vendor" value={formatMoney(q.data.today.netMinor, q.data.currency)} hint={`qlub commission ${formatMoney(q.data.today.feeMinor, q.data.currency)}`} />
            <StatTile label="Average ticket" value={q.data.today.avgTicketMinor === null ? "—" : formatMoney(q.data.today.avgTicketMinor, q.data.currency)} />
            <StatTile label="Average prep" value={fmtPrep(q.data.today.avgPrepSeconds)} hint="Order to ready" />
          </section>

          <Panel
            title="Live QSR orders"
            actions={
              <Link href="/qsr" className="inline-flex items-center gap-1 text-small font-semibold text-brand-strong hover:underline">
                Open QSR Orders <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            }
          >
            <div className="grid grid-cols-3 divide-x divide-line">
              {(
                [
                  ["New", q.data.open.new, Bell, "text-status-new-fg"],
                  ["Preparing", q.data.open.preparing, ChefHat, "text-status-prep-fg"],
                  ["Ready", q.data.open.ready, CheckCircle, "text-status-ready-fg"],
                ] as const
              ).map(([label, n, Icon, cls]) => (
                <div key={label} className="flex items-center gap-3 px-5 py-4">
                  <Icon className={`h-6 w-6 ${cls}`} aria-hidden />
                  <span className="text-small text-ink-soft">{label}</span>
                  <span className="ml-auto font-display text-h1 font-bold tabular-nums">{n}</span>
                </div>
              ))}
            </div>
          </Panel>

          {many && (
            <Panel title="Vendors today">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th className="text-right">Orders</th>
                      <th className="text-right">Gross</th>
                      <th className="text-right">Commission</th>
                      <th className="text-right">Net</th>
                      <th className="text-right">Avg prep</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...q.data.byVendor]
                      .sort((a, b) => b.grossMinor - a.grossMinor)
                      .map((r) => (
                        <tr key={r.vendor.id}>
                          <td>
                            <VendorBadge vendor={r.vendor} size="sm" />
                          </td>
                          <td className="text-right tabular-nums">{r.orders}</td>
                          <td className="text-right tabular-nums">{formatMoney(r.grossMinor, q.data.currency)}</td>
                          <td className="text-right tabular-nums text-ink-soft">{formatMoney(r.feeMinor, q.data.currency)}</td>
                          <td className="text-right font-semibold tabular-nums">{formatMoney(r.netMinor, q.data.currency)}</td>
                          <td className="text-right tabular-nums">{fmtPrep(r.avgPrepSeconds)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <Panel
            title="Recent orders"
            actions={
              <Link href="/orders" className="inline-flex items-center gap-1 text-small font-semibold text-brand-strong hover:underline">
                All orders <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            }
          >
            {q.data.recentOrders.length === 0 ? (
              <EmptyState title="No orders yet today" body="New QSR orders show up here and on QSR Orders." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Pickup</th>
                      {many && <th>Vendor</th>}
                      <th>Table</th>
                      <th>Status</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.recentOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="tabular-nums">{formatTime(o.createdAt, me.venue.timezone)}</td>
                        <td className="font-display font-bold">{o.pickupCode}</td>
                        {many && (
                          <td>
                            <VendorCell vendorId={o.vendorId} />
                          </td>
                        )}
                        <td>{o.tableLabel}</td>
                        <td>
                          <StatusChip status={o.status} />
                        </td>
                        <td className="text-right tabular-nums">{formatMoney(o.subtotalMinor, o.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </PanelPage>
  );
}
