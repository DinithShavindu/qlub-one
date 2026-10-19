import type { VendorOrderStatus } from "@one/contracts";
import { cn } from "@one/ui";

const STEPS = ["New", "Preparing", "Ready", "Collected"] as const;
const INDEX: Partial<Record<VendorOrderStatus, number>> = { new: 0, preparing: 1, ready: 2, collected: 3 };

/** 4-step progress: New → Preparing → Ready → Collected. */
export function OrderProgress({ status, onDark }: { status: VendorOrderStatus; onDark?: boolean }) {
  const current = INDEX[status] ?? -1;
  const label = current >= 0 ? `Step ${current + 1} of 4: ${STEPS[current]}` : "Sending to the stall";
  return (
    <div>
      <span className="sr-only">{label}</span>
      <ol className="grid grid-cols-4 gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-col gap-1">
            <span
              className={cn(
                "h-1.5 rounded-full transition-colors",
                i <= current ? (onDark ? "bg-status-ready-fg" : "bg-status-ready") : onDark ? "bg-status-ready-fg/30" : "bg-surface-sunk",
              )}
            />
            <span
              className={cn(
                "text-micro",
                onDark ? "text-status-ready-fg" : i <= current ? "font-semibold text-ink-soft" : "text-ink-muted",
                onDark && i > current && "opacity-70",
              )}
            >
              {s}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
