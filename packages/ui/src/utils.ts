import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import type { AccentToken } from "@one/contracts";

export { formatMoney } from "@one/contracts";

/** tailwind-merge must know our custom font-size tokens, or `text-h2` and `text-ink` look like the same group. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "display-kds", "h1", "h2", "body", "small", "micro"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** "just now", "4 min ago", "2 h ago" */
export function formatTimeAgo(iso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

/** 222 -> "3:42" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** 222000 -> "3m 42s" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function formatTime(iso: string, timeZone = "Asia/Dubai"): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
}

/** Static class maps so Tailwind can see every class name. */
export const ACCENT_BG: Record<AccentToken, string> = {
  "vendor-1": "bg-vendor-1",
  "vendor-2": "bg-vendor-2",
  "vendor-3": "bg-vendor-3",
  "vendor-4": "bg-vendor-4",
  "vendor-5": "bg-vendor-5",
  "vendor-6": "bg-vendor-6",
};
export const ACCENT_TEXT: Record<AccentToken, string> = {
  "vendor-1": "text-vendor-1",
  "vendor-2": "text-vendor-2",
  "vendor-3": "text-vendor-3",
  "vendor-4": "text-vendor-4",
  "vendor-5": "text-vendor-5",
  "vendor-6": "text-vendor-6",
};
export const ACCENT_BORDER: Record<AccentToken, string> = {
  "vendor-1": "border-vendor-1",
  "vendor-2": "border-vendor-2",
  "vendor-3": "border-vendor-3",
  "vendor-4": "border-vendor-4",
  "vendor-5": "border-vendor-5",
  "vendor-6": "border-vendor-6",
};
