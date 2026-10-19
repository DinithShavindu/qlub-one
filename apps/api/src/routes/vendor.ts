/**
 * Vendor panel routes. RULE: scope always comes from the session cookie — a vendor sees only
 * itself; a multivendor venue manager sees every vendor of its venue and may narrow to one
 * with `vendorId`, which is checked against that venue.
 */
import bcrypt from "bcryptjs";
import type { Context } from "hono";
import { Hono } from "hono";
import {
  AvailabilityRequest,
  KdsStatus,
  VendorLoginRequest,
  VendorOrderStatus,
  VendorRange,
  VendorStatusRequest,
  VendorSyncRequest,
  isMultivendor,
  type Vendor,
  type VendorHistoryResponse,
  type VendorMeResponse,
  type VendorOrder,
  type VendorOrdersResponse,
  type VendorVenueLookupResponse,
} from "@one/contracts";
import { db, NO_ID } from "@one/db";
import { clearVendorSession, requirePanel, setVendorSession, type PanelSession } from "../lib/auth";
import { AppError, notFound, parse } from "../lib/errors";
import { channel, sseResponse } from "../lib/events";
import { isToday, todayQueryFloor } from "../lib/time";
import { syncVendorMenu } from "../services/menu-sync";
import { setVendorOrderStatus } from "../services/orders";
import { getVenue, listVendors } from "../services/repo";
import { panelDashboard, panelOrders, panelPayments, panelReports, panelTables, syncTablesFromPos } from "../services/vendor-panel";

export const vendor = new Hono();

/* ── login ── */

/** Public: venue code → vendor tiles (+ whether a manager login exists) for the login picker. */
vendor.get("/vendor/venues/:code", async (c) => {
  const d = await db();
  const venue = await d.venues.findOne({ code: c.req.param("code").trim().toUpperCase() }, NO_ID);
  if (!venue) throw new AppError("NOT_FOUND", 404, "No venue with that code");
  const [vendors, manager] = await Promise.all([
    d.vendors.find({ venueId: venue.id }, NO_ID).sort({ sortOrder: 1 }).toArray(),
    d.venueManagers.countDocuments({ venueId: venue.id }),
  ]);
  const body: VendorVenueLookupResponse = {
    venue: { id: venue.id, name: venue.name, code: venue.code, type: venue.type, hasManager: isMultivendor(venue.type) && manager > 0 },
    vendors: vendors.map((v) => ({ id: v.id, name: v.name, emoji: v.emoji, accentToken: v.accentToken, slug: v.slug, isOpen: v.isOpen })),
  };
  return c.json(body);
});

const MAX_TRIES = 5;
const COOLDOWN_MS = 30_000;
const attempts = new Map<string, { fails: number; until: number }>();

async function me(s: PanelSession): Promise<VendorMeResponse> {
  const venue = await getVenue(s.venueId);
  const all = await listVendors(venue.id);
  if (s.role === "manager") return { role: "manager", vendor: null, vendors: all, venue };
  const self = all.find((v) => v.id === s.vendorId);
  if (!self) throw new AppError("UNAUTHORIZED", 401, "This vendor no longer exists — log in again");
  return { role: "vendor", vendor: self, vendors: [self], venue };
}

vendor.post("/vendor/login", async (c) => {
  const req = parse(VendorLoginRequest, await c.req.json().catch(() => null));
  const key = req.vendorId ?? `manager:${req.venueId}`;
  const a = attempts.get(key);
  if (a && a.until > Date.now()) {
    const s = Math.ceil((a.until - Date.now()) / 1000);
    throw new AppError("PIN_COOLDOWN", 429, `Too many tries. Wait ${s}s.`, { retryAfterSeconds: s });
  }
  const d = await db();
  let session: PanelSession | null = null;
  if (req.vendorId) {
    const v = await d.vendors.findOne({ id: req.vendorId }, NO_ID);
    if (v && (await bcrypt.compare(req.pin, v.pinHash))) session = { role: "vendor", vendorId: v.id, venueId: v.venueId };
  } else {
    const m = await d.venueManagers.findOne({ venueId: req.venueId! }, NO_ID);
    if (m && (await bcrypt.compare(req.pin, m.pinHash))) session = { role: "manager", vendorId: null, venueId: m.venueId };
  }
  if (!session) {
    // an expired cooldown starts a fresh count
    const fails = (a && a.until === 0 ? a.fails : 0) + 1;
    if (fails >= MAX_TRIES) {
      attempts.set(key, { fails: 0, until: Date.now() + COOLDOWN_MS });
      throw new AppError("PIN_COOLDOWN", 429, "Too many tries. Wait 30s.", { retryAfterSeconds: 30 });
    }
    attempts.set(key, { fails, until: 0 });
    throw new AppError("WRONG_PIN", 401, "Wrong PIN", { triesLeft: MAX_TRIES - fails });
  }
  attempts.delete(key);
  setVendorSession(c, session);
  return c.json(await me(session));
});

vendor.post("/vendor/logout", (c) => {
  clearVendorSession(c);
  return c.json({ ok: true });
});

/* ── session-scoped ── */

/**
 * The vendors a request acts on. Vendor session → itself (any `vendorId` sent is ignored).
 * Manager → every vendor of the venue, or the one `vendorId` names (404 if it isn't in the venue).
 */
async function scope(c: Context, requested: string | undefined = c.req.query("vendorId") || undefined) {
  const s = requirePanel(c);
  const m = await me(s);
  let vendors: Vendor[] = m.vendors;
  if (s.role === "manager" && requested) {
    vendors = m.vendors.filter((v) => v.id === requested);
    if (!vendors.length) throw notFound("Vendor");
  }
  return { s, venue: m.venue, vendors, ids: vendors.map((v) => v.id), narrowed: s.role === "vendor" || !!requested };
}

/** Exactly one vendor to act on (syncs): a vendor's own, or the manager's pick. */
async function oneVendor(c: Context, requested: string | undefined) {
  const sc = await scope(c, requested);
  if (sc.vendors.length !== 1) throw new AppError("VALIDATION_ERROR", 400, "Pick a vendor first");
  return { ...sc, vendor: sc.vendors[0]! };
}

vendor.get("/vendor/me", async (c) => c.json(await me(requirePanel(c))));

vendor.get("/vendor/orders", async (c) => {
  const { venue, ids } = await scope(c);
  const statuses = (c.req.query("status") ?? "new,preparing,ready")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => KdsStatus.safeParse(s).success);
  const d = await db();
  const [orders, today] = await Promise.all([
    d.vendorOrders.find({ vendorId: { $in: ids }, status: { $in: statuses as VendorOrder["status"][] } }, NO_ID).sort({ createdAt: 1 }).limit(300).toArray(),
    d.vendorOrders
      .find({ vendorId: { $in: ids }, createdAt: { $gte: todayQueryFloor() }, status: { $nin: ["failed", "submitting"] } }, { projection: { _id: 0, createdAt: 1 } })
      .toArray(),
  ]);
  const body: VendorOrdersResponse = {
    vendorOrders: orders as VendorOrder[],
    todayCount: today.filter((o) => isToday(o.createdAt, venue.timezone)).length,
  };
  return c.json(body);
});

vendor.post("/vendor/orders/:vendorOrderId/status", async (c) => {
  const s = requirePanel(c);
  const { status } = parse(VendorStatusRequest, await c.req.json().catch(() => null));
  let vendorId = s.vendorId;
  if (s.role === "manager") {
    // a manager acts for whichever vendor owns the order — as long as it's in their venue
    const order = await (await db()).vendorOrders.findOne({ id: c.req.param("vendorOrderId"), venueId: s.venueId }, { projection: { _id: 0, vendorId: 1 } });
    if (!order) throw notFound("Order");
    vendorId = order.vendorId;
  }
  return c.json(await setVendorOrderStatus(vendorId!, c.req.param("vendorOrderId"), status));
});

vendor.get("/vendor/history", async (c) => {
  const { venue, ids } = await scope(c);
  const d = await db();
  const floor = todayQueryFloor();
  const [orders, ledger] = await Promise.all([
    d.vendorOrders.find({ vendorId: { $in: ids }, createdAt: { $gte: floor }, status: { $in: ["collected", "failed"] } }, NO_ID).sort({ createdAt: -1 }).toArray(),
    d.settlements.find({ vendorId: { $in: ids }, createdAt: { $gte: floor } }, NO_ID).toArray(),
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

/* ── panel pages ── */

const range = (c: Context) => parse(VendorRange, c.req.query("range") || "today");

vendor.get("/vendor/dashboard", async (c) => {
  const { venue, vendors } = await scope(c);
  return c.json(await panelDashboard(venue, vendors));
});

vendor.get("/vendor/orders/list", async (c) => {
  const { venue, ids } = await scope(c);
  const status = c.req.query("status") || undefined;
  return c.json(
    await panelOrders(venue, ids, {
      range: range(c),
      status: status ? parse(VendorOrderStatus, status) : undefined,
      search: c.req.query("q") || undefined,
      page: Math.max(0, Number(c.req.query("page") ?? 0) || 0),
      limit: Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 25) || 25)),
    }),
  );
});

vendor.get("/vendor/payments", async (c) => {
  const { venue, ids } = await scope(c);
  return c.json(await panelPayments(venue, ids, range(c)));
});

vendor.get("/vendor/reports", async (c) => {
  const { venue, vendors } = await scope(c);
  return c.json(await panelReports(venue, vendors, range(c)));
});

vendor.get("/vendor/tables", async (c) => {
  const { venue, ids, narrowed } = await scope(c);
  return c.json(await panelTables(venue, ids, !narrowed));
});

vendor.post("/vendor/tables/sync", async (c) => {
  const { vendorId } = parse(VendorSyncRequest, await c.req.json().catch(() => ({})));
  const { venue, vendor: v } = await oneVendor(c, vendorId);
  return c.json(await syncTablesFromPos(venue, v));
});

vendor.post("/vendor/menu/sync", async (c) => {
  const { vendorId } = parse(VendorSyncRequest, await c.req.json().catch(() => ({})));
  const { vendor: v } = await oneVendor(c, vendorId);
  if (v.posMode !== "mock_pos") throw new AppError("VALIDATION_ERROR", 400, `${v.name} uses a tablet — its menu is managed by qlub, not a POS`);
  const res = await syncVendorMenu(v);
  if (!res.ok) throw new AppError("POS_ERROR", 502, `Menu sync failed: ${res.error ?? "POS error"}`);
  return c.json(res);
});

vendor.get("/vendor/items", async (c) => {
  const { ids } = await scope(c);
  const d = await db();
  return c.json({ items: await d.menuItems.find({ vendorId: { $in: ids } }, NO_ID).sort({ vendorId: 1, sortOrder: 1 }).toArray() });
});

vendor.post("/vendor/items/:menuItemId/availability", async (c) => {
  // the item itself decides which vendor; it only has to be in this session's scope
  const { ids } = await scope(c, undefined);
  const { available } = parse(AvailabilityRequest, await c.req.json().catch(() => null));
  const d = await db();
  const item = await d.menuItems.findOneAndUpdate(
    { id: c.req.param("menuItemId"), vendorId: { $in: ids } },
    { $set: { available } },
    { returnDocument: "after", projection: { _id: 0 } },
  );
  if (!item) throw notFound("Item");
  return c.json(item);
});

vendor.get("/vendor/stream", (c) => {
  const s = requirePanel(c);
  return sseResponse(c, s.role === "manager" ? channel.kds(s.venueId) : channel.vendor(s.vendorId!));
});
