"use client";
import { memo } from "react";
import { Info, MoreHorizontal, Undo2 } from "lucide-react";
import type { KdsStatus, VendorOrder } from "@one/contracts";
import { PickupCode, STATUS_LABEL, VendorBadge, type VendorBadgeVendor } from "@one/ui";
import { AppButton } from "@/components/AppButton";
import { cx } from "@/lib/cx";
import { ACTION_LABEL, isBoardStatus, moveBackTarget, nextStatus } from "@/lib/kds";
import { PopoverMenu, type MenuEntry } from "../PopoverMenu";
import { AgeTimer } from "./AgeTimer";
import { OrderItems } from "./OrderItems";

export const KdsOrderCard = memo(function KdsOrderCard({
  order,
  now,
  fresh,
  onMove,
  onOpen,
  vendor,
}: {
  /** Shown on the combined (venue manager) board so each ticket says whose kitchen it is. */
  vendor?: VendorBadgeVendor;
  order: VendorOrder;
  now: number;
  fresh: boolean;
  onMove: (order: VendorOrder, to: KdsStatus, opts?: { undo?: boolean }) => void;
  onOpen: (order: VendorOrder) => void;
}) {
  const next = nextStatus(order.status);
  const back = moveBackTarget(order, now);
  const status = isBoardStatus(order.status) ? order.status : null;

  const entries: MenuEntry[] = [
    ...(back
      ? [
          {
            key: "back",
            label: `Move back to ${STATUS_LABEL[back]}`,
            hint: `${Math.max(0, Math.ceil((30_000 - (now - new Date(order.statusChangedAt).getTime())) / 1000))}s left`,
            icon: <Undo2 className="h-5 w-5" />,
            onSelect: () => onMove(order, back, { undo: true }),
          },
        ]
      : []),
    { key: "details", label: "Show details", icon: <Info className="h-5 w-5" />, onSelect: () => onOpen(order) },
    // ROADMAP: "Print ticket" (stretch) — needs a receipt printer integration.
  ];

  return (
    <article
      aria-label={`Order ${order.pickupCode}`}
      className={cx(
        "flex flex-col rounded-lg border-2 bg-surface shadow-card",
        fresh ? "animate-slide-in-top border-brand" : "border-line",
      )}
    >
      {/* pulsing ring is a separate layer so the slide-in and the pulse can both run */}
      <div className={cx("flex flex-col rounded-lg", fresh && "animate-pulse-border")}>
        <div className="flex items-start gap-1 pl-4 pr-1 pt-2">
          <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen(order)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(order);
              }
            }}
            aria-label={`Order ${order.pickupCode} details`}
            className="flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-2 rounded-md focus-visible:ring-2 focus-visible:ring-brand-strong"
          >
            <PickupCode code={order.pickupCode} size="kds" />
            <div className="flex min-w-0 flex-col items-end pt-1 text-right">
              <AgeTimer since={order.createdAt} now={now} className="text-h2" />
              <span className="mt-1 max-w-full truncate text-body font-semibold text-ink">
                {order.guestFirstName ?? "Guest"}
              </span>
              <span className="text-small text-ink-muted">Table {order.tableLabel}</span>
            </div>
          </div>
          <PopoverMenu label={`More actions for order ${order.pickupCode}`} trigger={<MoreHorizontal className="h-7 w-7" />} entries={entries} />
        </div>

        {vendor && (
          <div className="px-4 pt-1">
            <VendorBadge vendor={vendor} size="sm" />
          </div>
        )}
        {/* tapping the item list also opens the drawer; keyboard users use the header button above */}
        <div className="cursor-pointer px-4 pb-4 pt-2" onClick={() => onOpen(order)}>
          <OrderItems items={order.items} />
        </div>

        {status && next && (
          <div className="px-3 pb-3">
            <AppButton
              size="xl"
              block
              variant={status === "ready" ? "secondary" : "primary"}
              onClick={() => onMove(order, next)}
              aria-label={`${ACTION_LABEL[status]} — order ${order.pickupCode}`}
            >
              {ACTION_LABEL[status]}
            </AppButton>
          </div>
        )}
      </div>
    </article>
  );
});
