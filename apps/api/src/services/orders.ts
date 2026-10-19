import { KDS_FLOW, type KdsStatus, type VendorOrder, type VendorOrderStatus } from "@one/contracts";
import { db, NO_ID } from "@one/db";
import { adapterFor } from "../adapters";
import { AppError, notFound } from "../lib/errors";
import { channel, publish } from "../lib/events";
import { logger } from "../lib/logger";
import { nowIso } from "../lib/time";
import { getVendorDoc, toVendor } from "./repo";

export const UNDO_WINDOW_MS = 30_000;

/**
 * Allowed: one step forward (new→preparing→ready→collected), or one step back to the
 * previous status within 30s of the last change ("Move back" / undo).
 */
export function checkTransition(order: Pick<VendorOrder, "status" | "previousStatus" | "statusChangedAt">, to: KdsStatus, now = Date.now()): "forward" | "undo" {
  const from = order.status as VendorOrderStatus;
  const i = KDS_FLOW.indexOf(from as KdsStatus);
  const j = KDS_FLOW.indexOf(to);
  if (i === -1) throw new AppError("INVALID_STATUS_TRANSITION", 409, `Order is ${from} and can't be changed`);
  if (j === i + 1) return "forward";
  if (j === i - 1 && order.previousStatus === to && now - new Date(order.statusChangedAt).getTime() <= UNDO_WINDOW_MS) return "undo";
  if (j === i - 1) throw new AppError("INVALID_STATUS_TRANSITION", 409, "Too late to move this order back");
  throw new AppError("INVALID_STATUS_TRANSITION", 409, `Can't go from ${from} to ${to}`);
}

/** Vendor-scoped status change. `vendorId` MUST come from the session. */
export async function setVendorOrderStatus(vendorId: string, vendorOrderId: string, to: KdsStatus): Promise<VendorOrder> {
  const c = await db();
  // filter by session vendorId: another vendor's order is simply "not found"
  const order = await c.vendorOrders.findOne({ id: vendorOrderId, vendorId }, NO_ID);
  if (!order) throw notFound("Order");
  const kind = checkTransition(order, to);
  return applyStatus(order, to, kind);
}

export async function applyStatus(order: VendorOrder, to: VendorOrderStatus, kind: "forward" | "undo" | "pos"): Promise<VendorOrder> {
  const c = await db();
  const now = nowIso();
  const set: Partial<VendorOrder> = {
    status: to,
    previousStatus: kind === "undo" ? null : order.status,
    statusChangedAt: now,
    updatedAt: now,
  };
  if (kind !== "undo") {
    if (to === "preparing" && !order.preparingAt) set.preparingAt = now;
    if (to === "ready") set.readyAt = now;
    if (to === "collected") set.collectedAt = now;
  } else {
    if (order.status === "ready") set.readyAt = null;
    if (order.status === "collected") set.collectedAt = null;
  }
  // optimistic concurrency: only apply if nobody changed it meanwhile
  const res = await c.vendorOrders.findOneAndUpdate(
    { id: order.id, status: order.status },
    { $set: set },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (!res) throw new AppError("CONFLICT", 409, "Order changed on another screen — refresh");
  const updated = res as VendorOrder;

  publish([channel.vendor(updated.vendorId), channel.order(updated.masterOrderId)], "vendor_order.updated", {
    vendorOrderId: updated.id,
    status: updated.status,
    pickupCode: updated.pickupCode,
  });

  if (to === "collected" && kind !== "undo") {
    void closeOnPos(updated);
  }
  await refreshMasterStatus(updated.masterOrderId);
  return updated;
}

async function closeOnPos(order: VendorOrder) {
  try {
    const vendor = toVendor(await getVendorDoc(order.vendorId));
    await adapterFor(vendor).closeOrder?.(vendor, order.posOrderId);
  } catch (err) {
    logger.warn({ vendorOrderId: order.id, err: String(err) }, "closeOrder on POS failed (non-blocking)");
  }
}

/** When all non-failed vendor orders are collected → master completed (and back if undone). */
export async function refreshMasterStatus(masterOrderId: string) {
  const c = await db();
  const mo = await c.masterOrders.findOne({ id: masterOrderId }, NO_ID);
  if (!mo || mo.status === "payment_failed" || mo.status === "pending_payment") return;
  const vos = await c.vendorOrders.find({ masterOrderId }, NO_ID).toArray();
  const live = vos.filter((v) => v.status !== "failed");
  const anyFailed = vos.some((v) => v.status === "failed");
  const allCollected = live.length > 0 && live.every((v) => v.status === "collected");
  const next = allCollected ? "completed" : anyFailed ? "partially_failed" : "paid";
  if (next !== mo.status) {
    await c.masterOrders.updateOne({ id: masterOrderId }, { $set: { status: next } });
    publish([channel.order(masterOrderId)], "master_order.updated", { masterOrderId, status: next });
  }
}
