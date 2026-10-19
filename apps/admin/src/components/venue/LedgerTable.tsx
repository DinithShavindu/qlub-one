import { cx } from "@/lib/cx";
import { MoneyText, VendorBadge, formatTime } from "@one/ui";
import type { SettlementRow, Vendor } from "@one/contracts";

export function LedgerTable({
  entries,
  vendors,
  currency,
  timezone,
}: {
  entries: SettlementRow[];
  vendors: Map<string, Vendor>;
  currency: string;
  timezone: string;
}) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Vendor</th>
          <th>Vendor order</th>
          <th>Type</th>
          <th className="text-right">Gross</th>
          <th className="text-right">qlub fee</th>
          <th className="text-right">Net</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => {
          const v = vendors.get(e.vendorId);
          const reversal = e.type === "reversal";
          return (
            <tr key={e.id}>
              <td className="tabular-nums text-ink-soft" title={e.createdAt}>
                {new Date(e.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: timezone })} {formatTime(e.createdAt, timezone)}
              </td>
              <td>{v ? <VendorBadge vendor={v} size="sm" /> : <span className="text-ink-muted">Removed vendor</span>}</td>
              <td>
                <span className="font-display font-bold tabular-nums">{e.pickupCode}</span>{" "}
                <span className="font-mono text-micro text-ink-muted">{e.vendorOrderId}</span>
              </td>
              <td>
                <span
                  className={cx(
                    "rounded-sm px-2 py-0.5 text-micro font-semibold uppercase",
                    reversal ? "bg-status-failed text-status-failed-fg" : "bg-status-new text-status-new-fg",
                  )}
                >
                  {reversal ? "Reversal" : "Sale"}
                </span>
              </td>
              <td className="text-right">
                <MoneyText minor={e.grossMinor} currency={currency} />
              </td>
              <td className="text-right text-ink-soft">
                <MoneyText minor={e.feeMinor} currency={currency} />
              </td>
              <td className="text-right font-semibold">
                <MoneyText minor={e.netMinor} currency={currency} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
