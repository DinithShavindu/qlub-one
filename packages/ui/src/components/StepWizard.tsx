import { Check } from "lucide-react";
import { cn } from "../utils";

export function StepWizard({
  steps,
  current,
  onStepClick,
  maxReachable,
}: {
  steps: string[];
  current: number;
  onStepClick?: (index: number) => void;
  /** highest step index the user may jump to */
  maxReachable?: number;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Onboarding steps">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = onStepClick && i <= (maxReachable ?? current);
        return (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(i)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-small font-semibold transition",
                active && "bg-ink text-paper",
                done && !active && "bg-surface text-ink border border-line",
                !done && !active && "text-ink-muted",
                clickable ? "cursor-pointer" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-micro tabular-nums",
                  active ? "bg-brand text-on-brand" : done ? "bg-status-ready text-status-ready-fg" : "bg-surface-sunk text-ink-soft",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              {label}
            </button>
            {i < steps.length - 1 && <span className="h-px w-6 bg-line" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
