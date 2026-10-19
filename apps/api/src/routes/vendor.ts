/**
 * Vendor (KDS) routes. RULE: every query is scoped by the vendorId from the session cookie,
 * never from the request body or query string.
 */
import bcrypt from "bcryptjs";
import { Hono } from "hono";
import {
  AvailabilityRequest,
  KdsStatus,
  VendorLoginRequest,
  VendorStatusRequest,
  type VendorHistoryResponse,
  type VendorMeResponse,
  type VendorOrder,
  type VendorOrdersResponse,
  type VendorVenueLookupResponse,
} from "@one/contracts";
import { db, NO_ID } from "@one/db";
import { clearVendorSession, requireVendor, setVendorSession } from "../lib/auth";
import { AppError, notFound, parse } from "../lib/errors";
import { channel, sseResponse } from "../lib/events";
import { isToday, todayQueryFloor } from "../lib/time";
import { setVendorOrderStatus } from "../services/orders";
import { getVendorDoc, getVenue, toVendor } from "../services/repo";

export const vendor = new Hono();

/* ── login ── */

/** Public: venue code → vendor tiles for the login picker. */
vendor.get("/vendor/venues/:code", async (c) => {
  const d = await db();
  const venue = await d.venues.findOne({ code: c.req.param("code").trim().toUpperCase() }, NO_ID);
  if (!venue) throw new AppError("NOT_FOUND", 404, "No venue with that code");
  const vendors = await d.vendors.find({ venueId: venue.id }, NO_ID).sort({ sortOrder: 1 }).toArray();
  const body: VendorVenueLookupResponse = {
    venue: { id: venue.id, name: venue.name, code: venue.code },
    vendors: vendors.map((v) => ({ id: v.id, name: v.name, emoji: v.emoji, accentToken: v.accentToken, slug: v.slug, isOpen: v.isOpen })),
  };
  return c.json(body);
});

const MAX_TRIES = 5;
const COOLDOWN_MS = 30_000;
const attempts = new Map<string, { fails: number; until: number }>();

vendor.post("/vendor/login", async (c) => {
  const { vendorId, pin } = parse(VendorLoginRequest, await c.req.json().catch(() => null));
  const a = attempts.get(vendorId);
  if (a && a.until > Date.now()) {
    const s = Math.ceil((a.until - Date.now()) / 1000);
    throw new AppError("PIN_COOLDOWN", 429, `Too many tries. Wait ${s}s.`, { retryAfterSeconds: s });
  }
  const d = await db();
  const v = await d.vendors.findOne({ id: vendorId }, NO_ID);
  const ok = v ? await bcrypt.compare(pin, v.pinHash) : false;
  if (!v || !ok) {
    // an expired cooldown starts a fresh count
    const fails = (a && a.until === 0 ? a.fails : 0) + 1;
    if (fails >= MAX_TRIES) {
      attempts.set(vendorId, { fails: 0, until: Date.now() + COOLDOWN_MS });
      throw new AppError("PIN_COOLDOWN", 429, "Too many tries. Wait 30s.", { retryAfterSeconds: 30 });
    }
    attempts.set(vendorId, { fails, until: 0 });
    throw new AppError("WRONG_PIN", 401, "Wrong PIN", { triesLeft: MAX_TRIES - fails });
  }
  attempts.delete(vendorId);
  setVendorSession(c, { vendorId: v.id, venueId: v.venueId });
  const body: VendorMeResponse = { vendor: toVendor(v), venue: await getVenue(v.venueId) };
  return c.json(body);
});

vendor.post("/vendor/logout", (c) => {
  clearVendorSession(c);
  return c.json({ ok: true });
});

/* ── session-scoped ── */

vendor.get("/vendor/me", async (c) => {
  const s = requireVendor(c);
  const v = await getVendorDoc(s.vendorId);
  const body: VendorMeResponse = { vendor: toVendor(v), venue: await getVenue(v.venueId) };
  return c.json(body);
});

vendor.get("/vendor/orders", async (c) => {
  const { vendorId } = requireVendor(c);
  const statuses = (c.req.query("status") ?? "new,preparing,ready")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => KdsStatus.safeParse(s).success);
  const d = await db();
  const vendorDoc = await getVendorDoc(vendorId);
  const venue = await getVenue(vendorDoc.venueId);
  const [orders, today] = await Promise.all([
    d.vendorOrders.find({ vendorId, status: { $in: statuses as VendorOrder["status"][] } }, NO_ID).sort({ createdAt: 1 }).limit(200).toArray(),
    d.vendorOrders
      .find({ vendorId, createdAt: { $gte: todayQueryFloor() }, status: { $nin: ["failed", "submitting"] } }, { projection: { _id: 0, createdAt: 1 } })
      .toArray(),
  ]);
  const body: VendorOrdersResponse = {
    vendorOrders: orders as VendorOrder[],
    todayCount: today.filter((o) => isToday(o.createdAt, venue.timezone)).length,
  };
  return c.json(body);
});

vendor.post("/vendor/orders/:vendorOrderId/status", async (c) => {
  const { vendorId } = requireVendor(c);
  const { status } = parse(VendorStatusRequest, await c.req.json().catch(() => null));
  const updated = await setVendorOrderStatus(vendorId, c.req.param("vendorOrderId"), status);
  return c.json(updated);
});

vendor.get("/vendor/history", async (c) => {
  const { vendorId } = requireVendor(c);
  const d = await db();
  const venue = await getVenue((await getVendorDoc(vendorId)).venueId);
  const floor = todayQueryFloor();
  const [orders, ledger] = await Promise.all([
    d.vendorOrders.find({ vendorId, createdAt: { $gte: floor }, status: { $in: ["collected", "failed"] } }, NO_ID).sort({ createdAt: -1 }).toArray(),
    d.settlements.find({ vendorId, createdAt: { $gte: floor } }, NO_ID).toArray(),
  ]);
  const todays = (orders as VendorOrder[]).filter((o) => isToday(o.createdAt, venue.timezone));
  // totals cover the orders shown here (collected + failed), so count and money agree
  const shown = new Set(todays.map((o) => o.id));
  const todayLedger = ledger.filter((e) => isToday(e.createdAt, venue.timezone) && shown.has(e.vendorOrderId));
  const body: VendorHistoryResponse = {
    vendorOrders: todays,
    currency: venue.currency,
    totals: {
      orders: todays.filter((o) => o.status === "collected").length,
      grossMinor: todayLedger.reduce((a, e) => a + e.grossMinor, 0),
      feeMinor: todayLedger.reduce((a, e) => a + e.feeMinor, 0),
      netMinor: todayLedger.reduce((a, e) => a + e.netMinor, 0),
    },
  };
  return c.json(body);
});

vendor.get("/vendor/items", async (c) => {
  const { vendorId } = requireVendor(c);
  const d = await db();
  return c.json({ items: await d.menuItems.find({ vendorId }, NO_ID).sort({ sortOrder: 1 }).toArray() });
});

vendor.post("/vendor/items/:menuItemId/availability", async (c) => {
  const { vendorId } = requireVendor(c);
  const { available } = parse(AvailabilityRequest, await c.req.json().catch(() => null));
  const d = await db();
  const item = await d.menuItems.findOneAndUpdate(
    { id: c.req.param("menuItemId"), vendorId },
    { $set: { available } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (!item) throw notFound("Item");
  return c.json(item);
});

vendor.get("/vendor/stream", (c) => {
  const { vendorId } = requireVendor(c);
  return sseResponse(c, channel.vendor(vendorId));
});
