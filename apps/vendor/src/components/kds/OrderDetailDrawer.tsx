"use client";
import type { KdsStatus, VendorOrder } from "@one/contracts";
import { formatTime, MoneyText, PickupCode, Sheet, STATUS_LABEL, StatusChip } from "@one/ui";
import { AppButton } from "@/components/AppButton";
import { ACTION_LABEL, isBoardStatus, itemCount, moveBackTarget, nextStatus } from "@/lib/kds";
import { AgeTimer } from "./AgeTimer";
import { OrderItems } from "./OrderItems";

/** Same info as the card, bigger. Side drawer. */
export function OrderDetailDrawer({
  order,
  now,
  timezone,
  onClose,
  onMove,
}: {
  order: VendorOrder | null;
  now: number;
  timezone: string;
  onClose: () => void;
  onMove: (order: VendorOrder, to: KdsStatus, opts?: { undo?: boolean }) => void;
}) {
  if (!order) return null;
  const next = nextStatus(order.status);
  const back = moveBackTarget(order, now);
  const status = isBoardStatus(order.status) ? order.status : null;

  return (
    <Sheet open onClose={onClose} side="right" title={<PickupCode code={order.pickupCode} size="kds" />} className="max-w-xl">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip status={order.status} size="lg" />
          <AgeTimer since={order.createdAt} now={now} className="text-h1" />
        </div>
        <dl className="grid grid-cols-2 gap-4 text-body">
          <div>
            <dt className="text-small text-ink-muted">Guest</dt>
            <dd className="text-h2 font-semibold">{order.guestFirstName ?? "Guest"}</dd>
          </div>
          <div>
            <dt className="text-small text-ink-muted">Table</dt>
            <dd className="text-h2 font-semibold">{order.tableLabel}</dd>
          </div>
          <div>
            <dt className="text-small text-ink-muted">Placed</dt>
            <dd className="font-semibold tabular-nums">{formatTime(order.createdAt, timezone)}</dd>
          </div>
          <div>
            <dt className="text-small text-ink-muted">Items · subtotal</dt>
            <dd className="font-semibold tabular-nums">
              {itemCount(order)} · <MoneyText minor={order.subtotalMinor} currency={order.currency} />
            </dd>
          </div>
        </dl>
        <div className="border-t border-line pt-4">
          <OrderItems items={order.items} size="lg" />
        </div>
        <div className="flex flex-col gap-3">
          {status && next && (
            <AppButton size="xl" block variant={status === "ready" ? "secondary" : "primary"} onClick={() => { onMove(order, next); onClose(); }}>
              {ACTION_LABEL[status]}
            </AppButton>
          )}
          {back && (
            <AppButton size="xl" block variant="ghost" onClick={() => { onMove(order, back, { undo: true }); onClose(); }}>
              Move back to {STATUS_LABEL[back]}
            </AppButton>
          )}
        </div>
      </div>
    </Sheet>
  );
}
