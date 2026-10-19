/**
 * mock-pos → api webhook (stretch, mock-pos DESIGN.md §6). Mirrors real webhook-based adapters:
 * the kitchen marks a check on the POS and the guest app updates.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { VendorOrder } from "@one/contracts";
import { db, NO_ID } from "@one/db";
import { parse } from "../lib/errors";
import { logger } from "../lib/logger";
import { applyStatus } from "../services/orders";

export const webhooks = new Hono();

const MockPosWebhook = z.object({
  posVendorId: z.string(),
  checkId: z.string(),
  status: z.enum(["OPEN", "PAID", "IN_KITCHEN", "DONE", "VOID"]),
});

webhooks.post("/webhooks/mock-pos", async (c) => {
  const evt = parse(MockPosWebhook, await c.req.json().catch(() => null));
  const d = await db();
  const vendor = await d.vendors.findOne({ posVendorId: evt.posVendorId }, NO_ID);
  const order = vendor ? ((await d.vendorOrders.findOne({ vendorId: vendor.id, posOrderId: evt.checkId }, NO_ID)) as VendorOrder | null) : null;
  if (!order) {
    logger.info({ ...evt }, "webhook for unknown check — ignored");
    return c.json({ ok: true, ignored: true });
  }
  if (evt.status === "IN_KITCHEN" && order.status === "new") await applyStatus(order, "preparing", "pos");
  else if (evt.status === "DONE" && (order.status === "new" || order.status === "preparing")) await applyStatus(order, "ready", "pos");
  logger.info({ vendorOrderId: order.id, posStatus: evt.status }, "POS webhook applied");
  return c.json({ ok: true });
});
