"use client";
import { useState } from "react";
import { CreditCard } from "lucide-react";
import type { VendorRange } from "@one/contracts";
import { EmptyState, ErrorState, formatMoney, Skeleton, StatTile } from "@one/ui";
import { PanelPage } from "@/components/shell/PanelShell";
import { formatDateTime, Panel, RangePills, VendorCell } from "@/components/panel/ui";
import { cx } from "@/lib/cx";
import { usePanel } from "@/lib/panel";
import { usePayments } from "@/lib/queries";

export default function PaymentsPage() {
  const { me, isManager, vendor } = usePanel();
  const [range, setRange] = useState<VendorRange>("today");
  const q = usePayments(range);
  const many = isManager && !vendor;
  const gw = me.venue.gateway === "qlub_test" ? "qlub test gateway" : me.venue.gateway;

  return (
    <PanelPage title="Payments" subtitle={`Guest payments settled through ${gw}. Gross − qlub commission = net owed to the vendor.`} actions={<RangePills value={range} onChange={setRange} />}>
      {q.isPending ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </>
      ) : q.isError ? (
        <ErrorState title="Couldn't load payments" body={q.error.message} retry={() => void q.refetch()} />
      ) : (
        <>
          <section aria-label="Totals" className={cx("grid grid-cols-2 gap-4 lg:grid-cols-4 transition-opacity", q.isPlaceholderData && "opacity-60")}>
            <StatTile label="Gross" value={formatMoney(q.data.totals.grossMinor, q.data.currency)} />
            <StatTile label="qlub commission" value={formatMoney(q.data.totals.feeMinor, q.data.currency)} />
            <StatTile label="Net to vendor" value={formatMoney(q.data.totals.netMinor, q.data.currency)} emphasis />
            <StatTile label="Transactions" value={q.data.totals.sales} hint={q.data.totals.reversals ? `${q.data.totals.reversals} refunded` : "No refunds"} />
          </section>
          <Panel title="Transactions">
            {q.data.entries.length === 0 ? (
              <EmptyState icon={<CreditCard className="h-8 w-8" />} title="No payments in this range" />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Pickup</th>
                      {many && <th>Vendor</th>}
                      <th>Table</th>
                      <th className="text-right">Gross</th>
                      <th className="text-right">Commission</th>
                      <th className="text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.entries.map((e) => (
                      <tr key={e.id}>
                        <td className="whitespace-nowrap tabular-nums">{formatDateTime(e.createdAt, me.venue.timezone)}</td>
                        <td>
                          <span className={cx("rounded-sm px-2 py-1 text-small font-semibold", e.type === "sale" ? "bg-status-ready text-status-ready-fg" : "bg-status-failed text-status-failed-fg")}>
                            {e.type === "sale" ? "Sale" : "Refund"}
                          </span>
                        </td>
                        <td className="font-display font-bold">{e.pickupCode}</td>
                        {many && (
                          <td>
                            <VendorCell vendorId={e.vendorId} />
                          </td>
                        )}
                        <td>{e.tableLabel}</td>
                        <td className="text-right tabular-nums">{formatMoney(e.grossMinor, q.data.currency)}</td>
                        <td className="text-right tabular-nums text-ink-soft">{formatMoney(e.feeMinor, q.data.currency)}</td>
                        <td className="text-right font-semibold tabular-nums">{formatMoney(e.netMinor, q.data.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={many ? 5 : 4}>Total</td>
                      <td className="text-right tabular-nums">{formatMoney(q.data.totals.grossMinor, q.data.currency)}</td>
                      <td className="text-right tabular-nums">{formatMoney(q.data.totals.feeMinor, q.data.currency)}</td>
                      <td className="text-right tabular-nums">{formatMoney(q.data.totals.netMinor, q.data.currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </PanelPage>
  );
}
