import { formatClock } from "@one/ui";
import { cx } from "@/lib/cx";

const WARN_S = 8 * 60;
const LATE_S = 15 * 60;

/** "4:12" since the order was placed. brand-strong after 8 min, status-failed after 15 min. */
export function AgeTimer({ since, now, className }: { since: string; now: number; className?: string }) {
  const s = Math.max(0, (now - new Date(since).getTime()) / 1000);
  const tone = s >= LATE_S ? "late" : s >= WARN_S ? "warn" : "ok";
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-sm px-2 font-display font-bold tabular-nums",
        tone === "late" && "bg-status-failed text-status-failed-fg",
        tone === "warn" && "text-brand-strong",
        tone === "ok" && "text-ink-soft",
        className,
      )}
      title={tone === "late" ? "Waiting over 15 minutes" : tone === "warn" ? "Waiting over 8 minutes" : "Time since order"}
    >
      <span className="sr-only">Waiting </span>
      {formatClock(s)}
    </span>
  );
}
