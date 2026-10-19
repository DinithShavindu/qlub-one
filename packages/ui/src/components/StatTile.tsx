import type { ReactNode } from "react";
import { cn } from "../utils";

export function StatTile({
  label,
  value,
  delta,
  hint,
  emphasis = false,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  hint?: ReactNode;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-line bg-surface p-4 shadow-card", emphasis && "border-brand/60", className)}>
      <p className="text-micro font-semibold uppercase text-ink-muted">{label}</p>
      <p className={cn("mt-1 font-display font-bold tabular-nums", emphasis ? "text-display" : "text-h1")}>{value}</p>
      {delta && <p className="mt-1 text-small font-semibold text-brand-strong">{delta}</p>}
      {hint && <p className="mt-1 text-small text-ink-muted">{hint}</p>}
    </div>
  );
}
