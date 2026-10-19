"use client";
import { cx } from "@/lib/cx";
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

import { formatTimer } from "@/lib/format";

/** "Setup time 01:42" — computed from the server-side onboarding run, so it survives reloads. */
export function OnboardingTimer({ startedAt, finishedAt }: { startedAt: string | null; finishedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt || finishedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt, finishedAt]);
  const end = finishedAt ? new Date(finishedAt).getTime() : now;
  const secs = startedAt ? Math.round((end - new Date(startedAt).getTime()) / 1000) : 0;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-small font-semibold",
        finishedAt ? "border-status-ready bg-status-ready text-status-ready-fg" : "border-line bg-surface text-ink",
      )}
      aria-label={`Setup time ${formatTimer(secs)}`}
      title={startedAt ? undefined : "Starts when you create the venue"}
    >
      <Timer className="h-4 w-4" aria-hidden />
      Setup time <span className="font-display tabular-nums">{formatTimer(secs)}</span>
    </span>
  );
}
