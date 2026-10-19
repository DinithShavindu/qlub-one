"use client";
import { useRef, useState } from "react";
import { CreditCard } from "lucide-react";
import type { Simulate } from "@one/contracts";
import { cn } from "@one/ui";

const LONG_PRESS_MS = 600;

/** The only "payment method": a labelled test card. No card inputs exist anywhere. */
export function TestPaymentTile({
  simulate,
  onSimulateChange,
  disabled,
}: {
  simulate: Simulate | undefined;
  onSimulateChange: (s: Simulate | undefined) => void;
  disabled?: boolean;
}) {
  const [showDemo, setShowDemo] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShowDemo((v) => !v), LONG_PRESS_MS);
  };
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const options: { value: Simulate | undefined; label: string }[] = [
    { value: undefined, label: "Normal payment" },
    { value: "decline", label: "Simulate decline" },
    { value: "fail_one_vendor", label: "Simulate one vendor failing" },
  ];

  return (
    <section aria-labelledby="payment-heading" className="rounded-lg bg-surface p-4 shadow-card">
      <h2 id="payment-heading" className="text-small font-semibold">
        Payment
      </h2>
      <div className="mt-2 flex items-center gap-3 rounded-md border-2 border-dashed border-line bg-surface-sunk p-4">
        <CreditCard className="h-7 w-7 shrink-0 text-ink-soft" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold tabular-nums">Test card •••• 4242</p>
          <p className="text-small text-ink-muted">Test mode — demo only, no real charge</p>
        </div>
        <span
          // long-press reveals hidden demo toggles; not a control for guests
          onPointerDown={start}
          onPointerUp={cancel}
          onPointerLeave={cancel}
          onPointerCancel={cancel}
          onContextMenu={(e) => e.preventDefault()}
          className="shrink-0 select-none rounded-sm bg-ink px-2 py-1 text-micro font-bold uppercase text-paper [-webkit-touch-callout:none]"
        >
          Test mode
        </span>
      </div>
      {showDemo && (
        <fieldset className="mt-3 rounded-md border border-line p-3" disabled={disabled}>
          <legend className="px-1 text-micro font-semibold uppercase text-ink-muted">Demo toggles</legend>
          {options.map((o) => (
            <label key={o.label} className="flex min-h-11 cursor-pointer items-center gap-3 text-small">
              <input
                type="radio"
                name="simulate"
                checked={simulate === o.value}
                onChange={() => onSimulateChange(o.value)}
                className="h-5 w-5 accent-brand"
              />
              <span className={cn(simulate === o.value && "font-semibold")}>{o.label}</span>
            </label>
          ))}
        </fieldset>
      )}
    </section>
  );
}
