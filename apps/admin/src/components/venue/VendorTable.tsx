"use client";
import { MoneyText, VendorBadge } from "@one/ui";
import type { VendorStats } from "@one/contracts";
import { OpenToggle } from "@/components/OpenToggle";
import { formatPrep } from "@/lib/format";

export function VendorTable({ rows, currency, venueId }: { rows: VendorStats[]; currency: string; venueId: string }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Vendor</th>
          <th className="text-right">Orders</th>
          <th className="text-right">Gross</th>
          <th className="text-right">qlub fee</th>
          <th className="text-right">Net</th>
          <th className="text-right">Avg prep</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.vendor.id}>
            <td>
              <VendorBadge vendor={r.vendor} size="sm" />
            </td>
            <td className="text-right tabular-nums">{r.orders}</td>
            <td className="text-right">
              <MoneyText minor={r.grossMinor} currency={currency} />
            </td>
            <td className="text-right text-ink-soft">
              <MoneyText minor={r.feeMinor} currency={currency} />
            </td>
            <td className="text-right font-semibold">
              <MoneyText minor={r.netMinor} currency={currency} />
            </td>
            <td className="text-right tabular-nums">{formatPrep(r.avgPrepSeconds)}</td>
            <td>
              <OpenToggle vendor={r.vendor} venueId={venueId} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
