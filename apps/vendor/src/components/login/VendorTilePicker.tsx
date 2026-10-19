"use client";
import type { VendorVenueLookupResponse } from "@one/contracts";
import { ACCENT_BG } from "@one/ui";
import { cx } from "@/lib/cx";

type TileVendor = VendorVenueLookupResponse["vendors"][number];

/** Big emoji + name tiles; tap your stall to enter the PIN. */
export function VendorTilePicker({ vendors, onPick }: { vendors: TileVendor[]; onPick: (v: TileVendor) => void }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {vendors.map((v) => (
        <li key={v.id}>
          <button
            type="button"
            onClick={() => onPick(v)}
            className={cx(
              "flex min-h-[96px] w-full items-center gap-4 rounded-lg border border-line bg-surface p-4 text-left shadow-card transition",
              "hover:bg-surface-sunk active:scale-[0.99]",
              "focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
            )}
          >
            <span className="text-5xl leading-none" aria-hidden>
              {v.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-h2 font-bold">{v.name}</span>
              {!v.isOpen && <span className="mt-1 block text-small text-ink-muted">Closed to guests</span>}
            </span>
            <span className={cx("h-4 w-4 shrink-0 rounded-full", ACCENT_BG[v.accentToken])} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
