import { KDS_FLOW, type KdsStatus, type VendorOrder, type VendorOrderStatus } from "@one/contracts";

/** Statuses that live on the board (collected → history). */
export const BOARD_STATUSES = ["new", "preparing", "ready"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export const UNDO_WINDOW_MS = 30_000;
export const FRESH_PULSE_MS = 10_000;

export const COLUMN_META: Record<BoardStatus, { title: string; empty: string; header: string }> = {
  new: { title: "New", empty: "No new orders", header: "bg-status-new text-status-new-fg" },
  preparing: { title: "Preparing", empty: "Nothing preparing", header: "bg-status-prep text-status-prep-fg" },
  ready: { title: "Ready", empty: "Nothing waiting for pickup", header: "bg-status-ready text-status-ready-fg" },
};

export const ACTION_LABEL: Record<BoardStatus, string> = {
  new: "Start preparing",
  preparing: "Mark ready",
  ready: "Collected",
};

export function isBoardStatus(s: VendorOrderStatus): s is BoardStatus {
  return (BOARD_STATUSES as readonly string[]).includes(s);
}

export function nextStatus(s: VendorOrderStatus): KdsStatus | null {
  const i = KDS_FLOW.indexOf(s as KdsStatus);
  return i >= 0 && i < KDS_FLOW.length - 1 ? KDS_FLOW[i + 1] : null;
}

/** "Move back" is allowed for 30s after the last forward step (server enforces the same rule). */
export function moveBackTarget(o: VendorOrder, now: number): KdsStatus | null {
  const prev = o.previousStatus;
  if (!prev) return null;
  const i = KDS_FLOW.indexOf(o.status as KdsStatus);
  if (i <= 0 || KDS_FLOW[i - 1] !== prev) return null;
  return now - new Date(o.statusChangedAt).getTime() <= UNDO_WINDOW_MS ? (prev as KdsStatus) : null;
}

export function byCreatedAt(a: VendorOrder, b: VendorOrder) {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

export function itemCount(o: VendorOrder) {
  return o.items.reduce((n, i) => n + i.qty, 0);
}
