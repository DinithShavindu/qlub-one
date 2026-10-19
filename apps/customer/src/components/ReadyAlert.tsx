"use client";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { isAudioUnlocked, unlockAudio } from "@one/ui";

/** Browsers (iOS especially) keep audio muted until a tap — this button is that tap. */
export function ReadyAlert() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(isAudioUnlocked()), []);

  if (on) {
    return (
      <p className="flex items-center gap-1.5 text-small text-ink-muted">
        <BellRing className="h-4 w-4" aria-hidden /> Ready alerts on
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await unlockAudio();
        setOn(ok || isAudioUnlocked());
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-small font-semibold shadow-card hover:bg-surface-sunk focus-visible:ring-2 focus-visible:ring-brand-strong"
    >
      <span aria-hidden>🔔</span> Turn on ready alerts
    </button>
  );
}
