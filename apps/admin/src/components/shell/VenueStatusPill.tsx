import { cx } from "@/lib/cx";


export function VenueStatusPill({ status, className }: { status: "draft" | "live"; className?: string }) {
  const live = status === "live";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-micro font-semibold uppercase",
        live ? "bg-status-ready text-status-ready-fg" : "bg-surface-sunk text-ink-soft",
        className,
      )}
    >
      <span className={cx("h-2 w-2 rounded-full", live ? "bg-status-ready-fg" : "bg-ink-muted")} aria-hidden />
      {live ? "Live" : "Draft"}
    </span>
  );
}
