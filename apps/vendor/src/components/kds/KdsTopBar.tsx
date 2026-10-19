"use client";
import { Volume2, VolumeX } from "lucide-react";
import type { VendorMeResponse } from "@one/contracts";
import { ConnectionDot, formatTime, type ConnectionState } from "@one/ui";
import { usePrefs } from "@/lib/prefs";

/** Board toolbar inside the panel shell: clock, live connection, today's count, sound. */
export function KdsTopBar({
  me,
  now,
  connection,
  todayCount,
}: {
  me: VendorMeResponse;
  now: number;
  connection: ConnectionState;
  todayCount: number;
}) {
  const { soundOn, setSoundOn } = usePrefs();

  return (
    <div className="flex h-16 shrink-0 items-center gap-4 border-b border-line bg-surface px-4">
      <h1 className="font-display text-h2 font-bold">QSR Orders</h1>
      <span className="hidden text-small text-ink-muted md:inline">
        {me.role === "manager" ? `${me.venue.name} · every vendor` : me.vendor!.name}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
        <time className="hidden font-display text-h2 font-bold tabular-nums sm:inline" aria-label="Current time">
          {formatTime(new Date(now).toISOString(), me.venue.timezone)}
        </time>
        <ConnectionDot state={connection} />
        <span className="hidden text-body font-semibold tabular-nums text-ink-soft md:inline">
          {todayCount} {todayCount === 1 ? "order" : "orders"} today
        </span>
        <button
          type="button"
          onClick={() => setSoundOn(!soundOn)}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Sound on — tap to mute" : "Sound off — tap to unmute"}
          className="flex h-12 w-12 items-center justify-center rounded-md hover:bg-surface-sunk focus-visible:ring-2 focus-visible:ring-brand-strong"
        >
          {soundOn ? <Volume2 className="h-6 w-6" aria-hidden /> : <VolumeX className="h-6 w-6 text-brand-strong" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
