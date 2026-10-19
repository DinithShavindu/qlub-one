"use client";
import { useRouter } from "next/navigation";
import { History, LogOut, Menu, Settings, Volume2, VolumeX } from "lucide-react";
import type { VendorMeResponse } from "@one/contracts";
import { ConnectionDot, formatTime, VendorBadge, type ConnectionState } from "@one/ui";
import { useLogout } from "@/hooks/useLogout";
import { usePrefs } from "@/lib/prefs";
import { PopoverMenu } from "../PopoverMenu";

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
  const router = useRouter();
  const logout = useLogout();
  const { soundOn, setSoundOn } = usePrefs();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface pl-4 pr-1 sm:gap-4">
      <VendorBadge vendor={me.vendor} size="lg" className="min-w-0 shrink" />
      <span className="hidden truncate text-body text-ink-muted lg:inline">{me.venue.name}</span>
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
        <time className="hidden font-display text-h2 font-bold tabular-nums sm:inline" aria-label="Current time">
          {formatTime(new Date(now).toISOString(), me.venue.timezone)}
        </time>
        <ConnectionDot state={connection} />
        <span className="hidden text-body font-semibold tabular-nums text-ink-soft md:inline">
          {todayCount} {todayCount === 1 ? "order" : "orders"}
        </span>
        <button
          type="button"
          onClick={() => setSoundOn(!soundOn)}
          aria-pressed={soundOn}
          aria-label={soundOn ? "Sound on — tap to mute" : "Sound off — tap to unmute"}
          className="flex h-16 w-16 items-center justify-center rounded-md hover:bg-surface-sunk focus-visible:ring-2 focus-visible:ring-brand-strong"
        >
          {soundOn ? <Volume2 className="h-7 w-7" aria-hidden /> : <VolumeX className="h-7 w-7 text-brand-strong" aria-hidden />}
        </button>
        <PopoverMenu
          label="Menu"
          trigger={<Menu className="h-7 w-7" />}
          entries={[
            { key: "history", label: "Today's history", icon: <History className="h-5 w-5" />, onSelect: () => router.push("/history") },
            { key: "settings", label: "Settings", icon: <Settings className="h-5 w-5" />, onSelect: () => router.push("/settings") },
            { key: "logout", label: "Log out", icon: <LogOut className="h-5 w-5" />, danger: true, onSelect: () => void logout() },
          ]}
        />
      </div>
    </header>
  );
}
