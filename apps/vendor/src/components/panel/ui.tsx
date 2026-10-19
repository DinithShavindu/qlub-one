"use client";
import type { ReactNode } from "react";
import type { VendorRange } from "@one/contracts";
import { VendorBadge } from "@one/ui";
import { cx } from "@/lib/cx";
import { usePanel } from "@/lib/panel";

export const RANGE_LABEL: Record<VendorRange, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days" };

export function RangePills({ value, onChange, options = ["today", "7d", "30d"] }: { value: VendorRange; onChange: (r: VendorRange) => void; options?: VendorRange[] }) {
  return (
    <div role="radiogroup" aria-label="Date range" className="inline-flex rounded-full border border-line bg-surface p-1">
      {options.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          onClick={() => onChange(r)}
          className={cx("h-9 rounded-full px-4 text-small font-semibold transition", value === r ? "bg-brand text-on-brand" : "text-ink-soft hover:text-ink")}
        >
          {RANGE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          {title && <h2 className="font-display text-body font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Vendor badge for a row — only worth showing when a manager sees several vendors. */
export function VendorCell({ vendorId }: { vendorId: string }) {
  const { vendorsById } = usePanel();
  const v = vendorsById.get(vendorId);
  return v ? <VendorBadge vendor={v} size="sm" /> : <span className="text-ink-muted">—</span>;
}

/** "2026-10-19" → "Mon 19 Oct" */
export function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function formatDateTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("en-GB", { timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Banner shown on pages that act on a single vendor while a manager has "All vendors" selected. */
export function PickVendorHint({ what }: { what: string }) {
  return (
    <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-3 text-small text-ink-soft">
      Pick a vendor in the <span className="font-semibold">Vendor</span> filter at the top to {what}.
    </p>
  );
}
