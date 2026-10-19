"use client";
import { useState } from "react";
import type { VendorRange } from "@one/contracts";
import { ErrorState, formatMoney, Skeleton, VendorBadge } from "@one/ui";
import { PanelPage } from "@/components/shell/PanelShell";
import { formatDay, Panel, RANGE_LABEL, RangePills, VendorCell } from "@/components/panel/ui";
import { cx } from "@/lib/cx";
import { usePanel } from "@/lib/panel";
import { useReports } from "@/lib/queries";

export default function ReportsPage() {
  const { isManager, vendor } = usePanel();
  const [range, setRange] = useState<VendorRange>("7d");
  const q = useReports(range);
  const many = isManager && !vendor;

  return (
    <PanelPage title="Reports" subtitle="Sales by day, best sellers and (for venue managers) each vendor's share." actions={<RangePills value={range} onChange={setRange} />}>
      {q.isPending ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="Couldn't load reports" body={q.error.message} retry={() => void q.refetch()} />
      ) : (
        <div className={cx("flex flex-col gap-6 transition-opacity", q.isPlaceholderData && "opacity-60")}>
          {(() => {
            const cur = q.data.currency;
            const t = q.data.days.reduce(
              (a, d) => ({ orders: a.orders + d.orders, grossMinor: a.grossMinor + d.grossMinor, feeMinor: a.feeMinor + d.feeMinor, netMinor: a.netMinor + d.netMinor }),
              { orders: 0, grossMinor: 0, feeMinor: 0, netMinor: 0 },
            );
            return (
              <Panel title={`Daily sales · ${RANGE_LABEL[range]}`}>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th className="text-right">Orders</th>
                        <th className="text-right">Gross</th>
                        <th className="text-right">qlub commission</th>
                        <th className="text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...q.data.days].reverse().map((d) => (
                        <tr key={d.date} className={cx(d.orders === 0 && "text-ink-muted")}>
                          <td className="whitespace-nowrap">{formatDay(d.date)}</td>
                          <td className="text-right tabular-nums">{d.orders}</td>
                          <td className="text-right tabular-nums">{formatMoney(d.grossMinor, cur)}</td>
                          <td className="text-right tabular-nums">{formatMoney(d.feeMinor, cur)}</td>
                          <td className="text-right font-semibold tabular-nums">{formatMoney(d.netMinor, cur)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td className="text-right tabular-nums">{t.orders}</td>
                        <td className="text-right tabular-nums">{formatMoney(t.grossMinor, cur)}</td>
                        <td className="text-right tabular-nums">{formatMoney(t.feeMinor, cur)}</td>
                        <td className="text-right tabular-nums">{formatMoney(t.netMinor, cur)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Panel>
            );
          })()}

          <div className={cx("grid gap-6", many && "xl:grid-cols-2")}>
            <Panel title="Best sellers">
              {q.data.topItems.length === 0 ? (
                <p className="px-5 py-8 text-center text-small text-ink-muted">No items sold in this range.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item</th>
                      {many && <th>Vendor</th>}
                      <th className="text-right">Qty</th>
                      <th className="text-right">Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.topItems.map((it, i) => (
                      <tr key={`${it.vendorId}:${it.name}`}>
                        <td className="tabular-nums text-ink-muted">{i + 1}</td>
                        <td className="font-semibold">{it.name}</td>
                        {many && (
                          <td>
                            <VendorCell vendorId={it.vendorId} />
                          </td>
                        )}
                        <td className="text-right tabular-nums">{it.qty}</td>
                        <td className="text-right tabular-nums">{formatMoney(it.grossMinor, q.data.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            {many && (
              <Panel title="By vendor">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th className="text-right">Orders</th>
                      <th className="text-right">Gross</th>
                      <th className="text-right">Net</th>
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
                          <td className="text-right font-semibold tabular-nums">{formatMoney(r.netMinor, q.data.currency)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </Panel>
            )}
          </div>
        </div>
      )}
    </PanelPage>
  );
}
