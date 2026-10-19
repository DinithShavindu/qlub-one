import type { VendorOrder } from "@one/contracts";
import { formatDuration, formatTime, MoneyText, PickupCode, StatusChip } from "@one/ui";
import { itemCount } from "@/lib/kds";

function completedAt(o: VendorOrder): string | null {
  return o.status === "collected" ? o.collectedAt : o.status === "failed" ? o.updatedAt : null;
}

/** Prep time = placed → ready (falls back to collected if it skipped Ready). */
function prepMs(o: VendorOrder): number | null {
  const end = o.readyAt ?? o.collectedAt;
  if (!end || o.status === "failed") return null;
  return new Date(end).getTime() - new Date(o.createdAt).getTime();
}

export function HistoryTable({ orders, timezone }: { orders: VendorOrder[]; timezone: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
      <table className="w-full min-w-[720px] text-left text-body">
        <caption className="sr-only">Today&apos;s completed orders</caption>
        <thead className="bg-surface-sunk text-small text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Code</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Items</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 font-semibold">Placed</th>
            <th scope="col" className="px-4 py-3 font-semibold">Completed</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Prep time</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const done = completedAt(o);
            const prep = prepMs(o);
            return (
              <tr key={o.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <PickupCode code={o.pickupCode} className="text-h2" />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{itemCount(o)}</td>
                <td className="px-4 py-3 text-right">
                  <MoneyText minor={o.subtotalMinor} currency={o.currency} />
                </td>
                <td className="px-4 py-3">
                  <StatusChip status={o.status} />
                </td>
                <td className="px-4 py-3 tabular-nums">{formatTime(o.createdAt, timezone)}</td>
                <td className="px-4 py-3 tabular-nums">{done ? formatTime(done, timezone) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{prep !== null ? formatDuration(prep) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
