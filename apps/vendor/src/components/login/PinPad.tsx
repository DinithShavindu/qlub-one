"use client";
import { useEffect } from "react";
import { Delete } from "lucide-react";
import { cx } from "@/lib/cx";

export const PIN_LENGTH = 4;

/** 4-digit PIN pad with 72px keys. Also accepts the physical keyboard (digits + Backspace). */
export function PinPad({
  value,
  onChange,
  disabled = false,
  error = false,
  shakeKey = 0,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  error?: boolean;
  /** Bump to replay the shake animation. */
  shakeKey?: number;
}) {
  const press = (d: string) => {
    if (disabled || value.length >= PIN_LENGTH) return;
    onChange(value + d);
  };
  const back = () => !disabled && onChange(value.slice(0, -1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        if (value.length < PIN_LENGTH) onChange(value + e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        onChange(value.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onChange, disabled]);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div
        key={shakeKey}
        className={cx("flex gap-4", shakeKey > 0 && "animate-shake")}
        role="img"
        aria-label={`${value.length} of ${PIN_LENGTH} digits entered`}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cx(
              "h-5 w-5 rounded-full border-2 transition",
              error ? "border-status-failed-fg" : "border-ink-soft",
              i < value.length && (error ? "bg-status-failed-fg" : "bg-ink"),
            )}
          />
        ))}
      </div>
      <div className="grid w-full max-w-xs grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)} disabled={disabled} label={d}>
            {d}
          </Key>
        ))}
        <Key onClick={() => !disabled && onChange("")} disabled={disabled || value.length === 0} label="Clear" small>
          Clear
        </Key>
        <Key onClick={() => press("0")} disabled={disabled} label="0">
          0
        </Key>
        <Key onClick={back} disabled={disabled || value.length === 0} label="Delete last digit">
          <Delete className="h-7 w-7" aria-hidden />
        </Key>
      </div>
    </div>
  );
}

function Key({
  children,
  onClick,
  disabled,
  label,
  small = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cx(
        "flex h-[72px] items-center justify-center rounded-lg border border-line bg-surface font-display font-bold tabular-nums text-ink shadow-card transition",
        "hover:bg-surface-sunk active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40",
        "focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        small ? "text-body" : "text-h1",
      )}
    >
      {children}
    </button>
  );
}
