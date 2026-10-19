import { cn } from "../utils";

export type ConnectionState = "live" | "reconnecting" | "offline";

const MAP: Record<ConnectionState, { label: string; dot: string }> = {
  live: { label: "Live", dot: "bg-vendor-3" },
  reconnecting: { label: "Reconnecting", dot: "bg-brand animate-pulse" },
  offline: { label: "Offline", dot: "bg-status-failed-fg" },
};

export function ConnectionDot({ state, className }: { state: ConnectionState; className?: string }) {
  const { label, dot } = MAP[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-small text-ink-soft", className)} role="status">
      <span className={cn("h-2.5 w-2.5 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  );
}
