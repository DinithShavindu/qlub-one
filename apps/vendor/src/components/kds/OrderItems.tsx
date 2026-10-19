import type { VendorOrderItem } from "@one/contracts";
import { cx } from "@/lib/cx";

/** Qty in bold + name; notes italic, highlighted, on their own line. */
export function OrderItems({ items, size = "md" }: { items: VendorOrderItem[]; size?: "md" | "lg" }) {
  return (
    <ul className={cx("flex flex-col", size === "lg" ? "gap-4" : "gap-2")}>
      {items.map((it) => (
        <li key={it.id} className={cx(size === "lg" ? "text-h1" : "text-h2")}>
          <span className="flex gap-2">
            <span className="min-w-[2.5ch] shrink-0 font-display font-bold tabular-nums">{it.qty}×</span>
            <span className="min-w-0 break-words font-semibold">{it.name}</span>
          </span>
          {it.note && (
            <span
              className={cx(
                "mt-1 block rounded-sm bg-status-prep px-2 py-1 italic text-status-prep-fg",
                size === "lg" ? "ml-[3ch] text-h2" : "ml-[3.2ch] text-body",
              )}
            >
              <span className="sr-only">Note: </span>
              {it.note}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
