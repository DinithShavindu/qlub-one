"use client";
import { Minus, Plus } from "lucide-react";
import { cn } from "../utils";

export function QtyStepper({
  value,
  onChange,
  min = 0,
  max = 50,
  label = "Quantity",
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label?: string;
  className?: string;
}) {
  const btn =
    "flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-surface-sunk disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div className={cn("inline-flex items-center rounded-md border border-line bg-surface", className)} role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Decrease quantity">
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Increase quantity">
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
