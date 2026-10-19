import type { Vendor, VendorOrder } from "@one/contracts";
import { cn, formatMoney, PickupCode, StatusChip, VendorBadge } from "@one/ui";
import { OrderProgress } from "./OrderProgress";

export function itemsSummary(vo: VendorOrder): string {
  return vo.items.map((i) => `${i.qty}× ${i.name}`).join(", ");
}

export function failedCopy(vendorName: string, vo: VendorOrder): string {
  return `${vendorName} couldn't take this part. ${formatMoney(vo.refundedMinor || vo.subtotalMinor, vo.currency)} refunded.`;
}

export function VendorOrderCard({ vo, vendor, popping }: { vo: VendorOrder; vendor: Vendor | undefined; popping: boolean }) {
  const name = vendor?.name ?? "This stall";
  const ready = vo.status === "ready";
  const failed = vo.status === "failed";
  const collected = vo.status === "collected";

  return (
    <article
      aria-label={`${name}: ${vo.status}`}
      className={cn(
        "rounded-lg p-4 shadow-card transition-colors",
        ready && "bg-status-ready text-status-ready-fg ring-4 ring-status-ready/30",
        failed && "border border-status-failed-fg/30 bg-status-failed text-status-failed-fg",
        !ready && !failed && "bg-surface",
        collected && "opacity-80",
        popping && "animate-ready-pop",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        {vendor ? <VendorBadge vendor={vendor} /> : <span className="font-semibold">{name}</span>}
        <StatusChip status={vo.status} className={cn(ready && "ring-1 ring-status-ready-fg/60")} />
      </header>
      <p className={cn("mt-2 text-small", ready || failed ? "" : "text-ink-soft")}>{itemsSummary(vo)}</p>

      {failed ? (
        <p className="mt-3 font-semibold">{failedCopy(name, vo)}</p>
      ) : ready ? (
        <div className="mt-4 flex flex-col items-center gap-1 text-center">
          <PickupCode code={vo.pickupCode} className="text-display" />
          <p className="font-semibold">
            Ready! Pick up at {name} — code {vo.pickupCode}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-small text-ink-muted">
          Pickup code <span className="font-display font-bold tabular-nums text-ink">{vo.pickupCode}</span>
          {vo.status === "submitting" && " · sending to the stall…"}
        </p>
      )}

      {!failed && (
        <div className="mt-4">
          <OrderProgress status={vo.status} onDark={ready} />
        </div>
      )}
    </article>
  );
}
