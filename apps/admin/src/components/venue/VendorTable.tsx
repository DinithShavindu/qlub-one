"use client";
import { MoneyText, VendorBadge } from "@one/ui";
import type { VendorStats } from "@one/contracts";
import { OpenToggle } from "@/components/OpenToggle";
import { formatPrep } from "@/lib/format";

export function VendorTable({ rows, currency, venueId }: { rows: VendorStats[]; currency: string; venueId: string }) {
  const th = "px-4 py-2.5 font-semibold";
  return (
    <table className="w-full text-left text-small">
      <thead className="border-b border-line bg-surface-sunk text-micro uppercase text-ink-muted">
        <tr>
          <th className={th}>Vendor</th>
          <th className={`${th} text-right`}>Orders</th>
          <th className={`${th} text-right`}>Gross</th>
          <th className={`${th} text-right`}>qlub fee</th>
          <th className={`${th} text-right`}>Net</th>
          <th className={`${th} text-right`}>Avg prep</th>
          <th className={th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.vendor.id} className="border-b border-line last:border-0">
            <td className="px-4 py-2.5">
              <VendorBadge vendor={r.vendor} size="sm" />
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{r.orders}</td>
            <td className="px-4 py-2.5 text-right">
              <MoneyText minor={r.grossMinor} currency={currency} />
            </td>
            <td className="px-4 py-2.5 text-right text-ink-soft">
              <MoneyText minor={r.feeMinor} currency={currency} />
            </td>
            <td className="px-4 py-2.5 text-right font-semibold">
              <MoneyText minor={r.netMinor} currency={currency} />
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatPrep(r.avgPrepSeconds)}</td>
            <td className="px-4 py-2.5">
              <OpenToggle vendor={r.vendor} venueId={venueId} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
