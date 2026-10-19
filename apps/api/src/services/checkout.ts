/**
 * Checkout & fan-out (ARCHITECTURE.md §6): one payment → one vendor order per vendor,
 * each submitted to its own POS in parallel; failures are refunded per vendor.
 */
import type { CheckoutRequest, MenuItem, OrderResponse, QuoteRequest, Vendor, VendorOrder, Venue } from "@one/contracts";
import { db, newId, nextSeq, NO_ID, type MasterOrderDoc } from "@one/db";
import { adapterFor, PosError } from "../adapters";
import { config } from "../config";
import { AppError } from "../lib/errors";
import { channel, publish } from "../lib/events";
import { logger } from "../lib/logger";
import { dateKey, nowIso } from "../lib/time";
import { charge, refund } from "./payment-gateway";
import { getTable, getVenue, listVendors, loadOrderResponse } from "./repo";
import { assertSplitInvariant, ledgerFor, priceCart, splitForVendors, type PricedCart } from "./split";

export async function quote(req: QuoteRequest): Promise<{ venue: Venue; priced: PricedCart; vendors: Vendor[] }> {
  const venue = await getVenue(req.venueId);
  const table = await getTable(req.tableId);
  if (table.venueId !== venue.id) throw new AppError("NOT_FOUND", 404, "Table not found at this venue");
  const vendors = await listVendors(venue.id);
  const c = await db();
  const ids = [...new Set(req.lines.map((l) => l.menuItemId))];
  const items = (await c.menuItems.find({ id: { $in: ids } }, NO_ID).toArray()) as MenuItem[];
  const priced = priceCart(req.lines, new Map(items.map((i) => [i.id, i])), new Map(vendors.map((v) => [v.id, v])), venue.id);
  return { venue, priced, vendors };
}

async function pickupCodeFor(vendor: Vendor, venue: Venue): Promise<string> {
  const n = await nextSeq(`pickup:${vendor.id}:${dateKey(new Date(), venue.timezone)}`);
  return `${vendor.letter}-${String(n % 100).padStart(2, "0")}`;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new PosError("POS timeout", "timeout")), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

/** Guest-safe failure copy; the raw POS error goes to logs + failureReason detail for ops. */
function friendlyReason(err: unknown): string {
  if (err instanceof PosError) {
    switch (err.kind) {
      case "timeout":
        return "Stall's system didn't respond in time";
      case "unavailable":
        return "Stall's system is offline";
      case "rejected":
        return err.message;
      case "mismatch":
        return "Price check with the stall failed";
      default:
        return "Stall's system returned an error";
    }
  }
  if (err instanceof Error && err.message.startsWith("Simulated")) return err.message;
  return "Stall couldn't accept the order";
}

export async function checkout(req: CheckoutRequest, guestToken: string): Promise<OrderResponse> {
  const c = await db();

  // idempotent retry (same guest + key) → same order, no second charge
  if (req.idempotencyKey) {
    const prior = await c.masterOrders.findOne({ guestToken, idempotencyKey: req.idempotencyKey }, NO_ID);
    if (prior && prior.status !== "payment_failed") return loadOrderResponse(prior.id, guestToken);
  }

  // 1–2. validate + price server-side
  const { venue, priced, vendors } = await quote(req);
  if (venue.status !== "live") throw new AppError("VENUE_NOT_LIVE", 409, "This venue isn't taking orders yet");
  if (priced.issues.length) {
    const closed = priced.issues.find((i) => i.code === "VENDOR_CLOSED");
    throw new AppError(
      closed ? "VENDOR_CLOSED" : "ITEM_UNAVAILABLE",
      409,
      priced.issues.map((i) => i.message).join(" "),
      { issues: priced.issues },
    );
  }
  if (!priced.groups.length) throw new AppError("VALIDATION_ERROR", 400, "Cart is empty");
  assertSplitInvariant(priced.subtotalMinor, priced.groups);
  const table = await getTable(req.tableId);
  const vendorsById = new Map(vendors.map((v) => [v.id, v]));

  // 3. master order
  const mo: MasterOrderDoc = {
    id: newId("mo"),
    venueId: venue.id,
    tableId: table.id,
    tableLabel: table.label,
    guestFirstName: req.guestFirstName?.trim() || null,
    status: "pending_payment",
    subtotalMinor: priced.subtotalMinor,
    totalMinor: priced.totalMinor,
    refundedMinor: 0,
    currency: venue.currency,
    paymentRef: null,
    createdAt: nowIso(),
    guestToken,
    idempotencyKey: req.idempotencyKey ?? null,
  };
  try {
    await c.masterOrders.insertOne({ ...mo });
  } catch (err) {
    // a previous attempt with this key was declined → allow retry by clearing the old key
    if ((err as { code?: number }).code === 11000 && req.idempotencyKey) {
      await c.masterOrders.updateOne({ guestToken, idempotencyKey: req.idempotencyKey }, { $set: { idempotencyKey: null } });
      await c.masterOrders.insertOne({ ...mo });
    } else throw err;
  }

  // 4. charge once
  const result = await charge(mo.totalMinor, req.paymentMethod, req.simulate);
  if (!result.ok) {
    await c.masterOrders.updateOne({ id: mo.id }, { $set: { status: "payment_failed" } });
    throw new AppError("PAYMENT_DECLINED", 402, "Payment didn't go through. Nothing was charged.");
  }

  // 5. paid
  await c.masterOrders.updateOne({ id: mo.id }, { $set: { status: "paid", paymentRef: result.ref } });
  mo.status = "paid";
  mo.paymentRef = result.ref;

  // 6. fan-out in parallel
  const splits = splitForVendors(priced.groups, venue.feeBps);
  const failVendorId =
    req.simulate === "fail_one_vendor"
      ? ([...priced.groups].reverse().find((g) => vendorsById.get(g.vendorId)?.posMode === "mock_pos") ?? priced.groups.at(-1))?.vendorId
      : undefined;

  const outcomes = await Promise.allSettled(
    priced.groups.map((group, idx) =>
      fanOutOne({
        venue,
        vendor: vendorsById.get(group.vendorId)!,
        group,
        split: splits[idx]!,
        masterOrder: mo,
        simulateFail: group.vendorId === failVendorId,
      }),
    ),
  );

  // 7. master status
  const vendorOrders = outcomes.map((o) => (o.status === "fulfilled" ? o.value : null)).filter((v): v is VendorOrder => !!v);
  const failed = vendorOrders.filter((v) => v.status === "failed");
  const refundedMinor = failed.reduce((a, v) => a + v.refundedMinor, 0);
  const status = failed.length ? "partially_failed" : "paid";
  await c.masterOrders.updateOne({ id: mo.id }, { $set: { status, refundedMinor } });
  publish([channel.order(mo.id)], "master_order.updated", { masterOrderId: mo.id, status });

  logger.info(
    { masterOrderId: mo.id, vendors: priced.groups.length, failed: failed.length, totalMinor: mo.totalMinor },
    "checkout complete",
  );
  // 8.
  return loadOrderResponse(mo.id, guestToken);
}

async function fanOutOne(args: {
  venue: Venue;
  vendor: Vendor;
  group: PricedCart["groups"][number];
  split: ReturnType<typeof splitForVendors>[number];
  masterOrder: MasterOrderDoc;
  simulateFail: boolean;
}): Promise<VendorOrder> {
  const { venue, vendor, group, split, masterOrder, simulateFail } = args;
  const c = await db();
  const now = nowIso();
  // a. vendor order (submitting)
  const vo: VendorOrder = {
    id: newId("vo"),
    masterOrderId: masterOrder.id,
    venueId: venue.id,
    vendorId: vendor.id,
    posOrderId: null,
    status: "submitting",
    pickupCode: await pickupCodeFor(vendor, venue),
    tableLabel: masterOrder.tableLabel,
    guestFirstName: masterOrder.guestFirstName,
    currency: venue.currency,
    subtotalMinor: split.subtotalMinor,
    feeMinor: split.feeMinor,
    netMinor: split.netMinor,
    refundedMinor: 0,
    failureReason: null,
    items: group.lines.map((l) => ({
      id: newId("voi"),
      menuItemId: l.menuItemId,
      posItemId: "",
      name: l.name,
      qty: l.qty,
      unitPriceMinor: l.unitPriceMinor,
      lineTotalMinor: l.lineTotalMinor,
      note: l.note,
    })),
    createdAt: now,
    updatedAt: now,
    preparingAt: null,
    readyAt: null,
    collectedAt: null,
    previousStatus: null,
    statusChangedAt: now,
  };
  // fill posItemId from menu items
  const menu = await c.menuItems.find({ id: { $in: vo.items.map((i) => i.menuItemId) } }, NO_ID).toArray();
  const posIds = new Map(menu.map((m) => [m.id, m.posItemId]));
  for (const it of vo.items) it.posItemId = posIds.get(it.menuItemId) ?? it.menuItemId;
  await c.vendorOrders.insertOne({ ...vo });

  const adapter = adapterFor(vendor);
  try {
    if (simulateFail) {
      await new Promise((r) => setTimeout(r, 400));
      throw new Error("Simulated: stall's system didn't respond");
    }
    await withTimeout(
      (async () => {
        // b. submit
        const { posOrderId } = await adapter.submitOrder(vendor, {
          externalRef: vo.id,
          tableLabel: vo.tableLabel,
          currency: vo.currency,
          expectedTotalMinor: vo.subtotalMinor,
          lines: vo.items.map((i) => ({ posItemId: i.posItemId, name: i.name, qty: i.qty, unitPriceMinor: i.unitPriceMinor, note: i.note })),
        });
        vo.posOrderId = posOrderId;
        // c. tell the POS it's paid
        await adapter.updatePaymentStatus(vendor, posOrderId, vo.subtotalMinor, masterOrder.paymentRef!, vo.currency);
      })(),
      config.posTimeoutMs,
    );

    // d. live on the KDS
    vo.status = "new";
    vo.updatedAt = vo.statusChangedAt = nowIso();
    await c.vendorOrders.updateOne({ id: vo.id }, { $set: { status: vo.status, posOrderId: vo.posOrderId, updatedAt: vo.updatedAt, statusChangedAt: vo.statusChangedAt } });
    await bookLedger(vo, true);
    publish([channel.vendor(vendor.id)], "vendor_order.created", vo);
    publish([channel.order(masterOrder.id)], "vendor_order.updated", { vendorOrderId: vo.id, status: vo.status, pickupCode: vo.pickupCode });
    return vo;
  } catch (err) {
    const reason = friendlyReason(err);
    logger.warn({ vendorOrderId: vo.id, vendorId: vendor.id, err: err instanceof Error ? err.message : String(err) }, "vendor fan-out failed");
    await refund(masterOrder.paymentRef!, vo.subtotalMinor);
    vo.status = "failed";
    vo.failureReason = reason;
    vo.refundedMinor = vo.subtotalMinor;
    vo.updatedAt = vo.statusChangedAt = nowIso();
    await c.vendorOrders.updateOne(
      { id: vo.id },
      { $set: { status: "failed", failureReason: reason, refundedMinor: vo.refundedMinor, posOrderId: vo.posOrderId, updatedAt: vo.updatedAt, statusChangedAt: vo.statusChangedAt } },
    );
    await bookLedger(vo, false);
    const data = { vendorOrderId: vo.id, reason, refundedMinor: vo.refundedMinor };
    publish([channel.order(masterOrder.id), channel.venue(venue.id)], "vendor_order.failed", data);
    return vo;
  }
}

async function bookLedger(vo: VendorOrder, ok: boolean) {
  const c = await db();
  const at = nowIso();
  const lines = ledgerFor({ subtotalMinor: vo.subtotalMinor, feeMinor: vo.feeMinor, netMinor: vo.netMinor }, ok);
  await c.settlements.insertMany(
    lines.map((l) => ({ id: newId("stl"), venueId: vo.venueId, vendorId: vo.vendorId, vendorOrderId: vo.id, ...l, createdAt: at })),
  );
}
