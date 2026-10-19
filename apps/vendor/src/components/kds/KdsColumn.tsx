"use client";
import { Bell, CheckCircle, ChefHat } from "lucide-react";
import type { KdsStatus, Vendor, VendorOrder } from "@one/contracts";
import { EmptyState } from "@one/ui";
import { cx } from "@/lib/cx";
import { COLUMN_META, type BoardStatus } from "@/lib/kds";
import { KdsOrderCard } from "./KdsOrderCard";

const ICONS: Record<BoardStatus, typeof Bell> = { new: Bell, preparing: ChefHat, ready: CheckCircle };

export function KdsColumn({
  status,
  orders,
  now,
  fresh,
  onMove,
  onOpen,
  className,
  vendorsById,
}: {
  /** Set on the combined board: each card shows its vendor. */
  vendorsById?: Map<string, Vendor>;
  status: BoardStatus;
  orders: VendorOrder[];
  now: number;
  fresh: Record<string, number>;
  onMove: (order: VendorOrder, to: KdsStatus, opts?: { undo?: boolean }) => void;
  onOpen: (order: VendorOrder) => void;
  className?: string;
}) {
  const meta = COLUMN_META[status];
  const Icon = ICONS[status];
  const headingId = `col-${status}`;
  return (
    <section id={`panel-${status}`} aria-labelledby={headingId} className={cx("min-h-0 flex-col", className ?? "flex")}>
      <h2
        id={headingId}
        className={cx(
          "flex h-14 shrink-0 items-center justify-between rounded-md px-4 font-display text-h2 font-bold",
          meta.header,
          // phone portrait shows tabs with counts instead
          "max-md:sr-only",
        )}
      >
        <span className="inline-flex items-center gap-2">
          <Icon className="h-6 w-6" aria-hidden />
          {meta.title}
        </span>
        <span className="tabular-nums" aria-label={`${orders.length} orders`}>
          {orders.length}
        </span>
      </h2>
      <div className={cx("flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-6 md:pt-3")}>
        {orders.length === 0 ? (
          <EmptyState
            icon={<Icon className="h-8 w-8" />}
            title={meta.empty}
            className="rounded-lg border border-dashed border-line"
          />
        ) : (
          orders.map((o) => <KdsOrderCard key={o.id} order={o} now={now} fresh={!!fresh[o.id]} onMove={onMove} onOpen={onOpen} vendor={vendorsById?.get(o.vendorId)} />)
        )}
      </div>
    </section>
  );
}
