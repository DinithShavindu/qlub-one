"use client";
import { cx } from "@/lib/cx";

/** Accessible switch with a 64px-tall hit area. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-16 shrink-0 items-center rounded-md px-2 focus-visible:ring-2 focus-visible:ring-brand-strong disabled:opacity-50"
    >
      <span className={cx("relative h-9 w-16 rounded-full border-2 transition", checked ? "border-brand bg-brand" : "border-line bg-surface-sunk")}>
        <span
          className={cx(
            "absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full shadow-card transition-all",
            checked ? "left-[calc(100%-1.875rem)] bg-on-brand" : "left-0.5 bg-ink-muted",
          )}
        />
      </span>
    </button>
  );
}
