import { AlertTriangle, Bell, Check, CheckCircle, ChefHat, Loader2 } from "lucide-react";
import type { VendorOrderStatus } from "@one/contracts";
import { cn } from "../utils";

const MAP: Record<VendorOrderStatus, { label: string; cls: string; Icon: typeof Bell }> = {
  submitting: { label: "Sending", cls: "bg-surface-sunk text-ink-soft", Icon: Loader2 },
  new: { label: "New", cls: "bg-status-new text-status-new-fg", Icon: Bell },
  preparing: { label: "Preparing", cls: "bg-status-prep text-status-prep-fg", Icon: ChefHat },
  ready: { label: "Ready", cls: "bg-status-ready text-status-ready-fg", Icon: CheckCircle },
  collected: { label: "Collected", cls: "bg-status-done text-status-done-fg", Icon: Check },
  failed: { label: "Failed", cls: "bg-status-failed text-status-failed-fg", Icon: AlertTriangle },
};

export const STATUS_LABEL: Record<VendorOrderStatus, string> = Object.fromEntries(
  Object.entries(MAP).map(([k, v]) => [k, v.label]),
) as Record<VendorOrderStatus, string>;

/** Status is text first, color second. */
export function StatusChip({ status, size = "md", className }: { status: VendorOrderStatus; size?: "md" | "lg"; className?: string }) {
  const { label, cls, Icon } = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm font-semibold",
        size === "lg" ? "px-3 py-1.5 text-body" : "px-2 py-1 text-small",
        cls,
        className,
      )}
    >
      <Icon className={cn(size === "lg" ? "h-5 w-5" : "h-4 w-4", status === "submitting" && "animate-spin")} aria-hidden />
      {label}
    </span>
  );
}
