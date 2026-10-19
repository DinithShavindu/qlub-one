/**
 * Read models for the vendor panel (dashboard, orders, payments, reports, tables) and the
 * POS syncs a vendor can trigger. Every function takes the vendor ids already resolved from
 * the session — callers never pass ids from the request without scoping them first.
 */
import type {
  TableSyncResponse,
  Vendor,
  VendorDashboardResponse,
  VendorOrder,
  VendorOrderListResponse,
  VendorOrderStatus,
  VendorPaymentsResponse,
  VendorRange,
  VendorReportsResponse,
  VendorTablesResponse,
  Venue,
} from "@one/contracts";
import { db, newId, newQrToken, NO_ID } from "@one/db";
import { mockPosAdapter, PosError } from "../adapters";
import { config } from "../config";
import { AppError } from "../lib/errors";
import { dateKey } from "../lib/time";

const BOARD: VendorOrderStatus[] = ["new", "preparing", "ready"];
const DONE_OR_LIVE: VendorOrderStatus[] = ["new", "preparing", "ready", "collected"];
const DAY_MS = 24 * 60 * 60 * 1000;

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const prepSeconds = (o: VendorOrder) => (o.readyAt ? Math.max(0, (new Date(o.readyAt).getTime() - new Date(o.createdAt).getTime()) / 1000) : null);
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);
const money = <T extends { grossMinor: number; feeMinor: number; netMinor: number }>(xs: T[]) => ({
  grossMinor: sum(xs, (e) => e.grossMinor),
  feeMinor: sum(xs, (e) => e.feeMinor),
  netMinor: sum(xs, (e) => e.netMinor),
});

export const RANGE_DAYS: Record<VendorRange, number> = { today: 1, "7d": 7, "30d": 30 };

/** Local dates (venue timezone) covered by a range, oldest first, plus a safe query floor. */
export function rangeWindow(days: number, timeZone: string, now = new Date()) {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(dateKey(new Date(now.getTime() - i * DAY_MS), timeZone));
  // +36h of slack: always before local midnight of the first day, then filter by date key
  return { keys, set: new Set(keys), floor: new Date(now.getTime() - (days - 1) * DAY_MS - 36 * 60 * 60 * 1000).toISOString() };
}

async function ordersIn(vendorIds: string[], floor: string) {
  const c = await db();
  return (await c.vendorOrders
    .find({ vendorId: { $in: vendorIds }, createdAt: { $gte: floor } }, NO_ID)
    .sort({ createdAt: -1 })
    .limit(5000)
    .toArray()) as VendorOrder[];
}

async function ledgerIn(vendorIds: string[], floor: string) {
  const c = await db();
  return c.settlements.find({ vendorId: { $in: vendorIds }, createdAt: { $gte: floor } }, NO_ID).sort({ createdAt: -1 }).toArray();
}

export async function panelDashboard(venue: Venue, vendors: Vendor[]): Promise<VendorDashboardResponse> {
  const ids = vendors.map((v) => v.id);
  const c = await db();
  const w = rangeWindow(1, venue.timezone);
  const [open, orders, ledger] = await Promise.all([
    c.vendorOrders.find({ vendorId: { $in: ids }, status: { $in: BOARD } }, { projection: { _id: 0, status: 1 } }).toArray(),
    ordersIn(ids, w.floor),
    ledgerIn(ids, w.floor),
  ]);
  const today = orders.filter((o) => w.set.has(dateKey(o.createdAt, venue.timezone)) && DONE_OR_LIVE.includes(o.status));
  const todayLedger = ledger.filter((e) => w.set.has(dateKey(e.createdAt, venue.timezone)));
  const totals = money(todayLedger);
  return {
    currency: venue.currency,
    open: {
      new: open.filter((o) => o.status === "new").length,
      preparing: open.filter((o) => o.status === "preparing").length,
      ready: open.filter((o) => o.status === "ready").length,
    },
    today: {
      orders: today.length,
      ...totals,
      avgPrepSeconds: avg(today.map(prepSeconds).filter((x): x is number => x !== null)),
      avgTicketMinor: today.length ? Math.round(totals.grossMinor / today.length) : null,
    },
    byVendor: vendors.map((vendor) => {
      const vos = today.filter((o) => o.vendorId === vendor.id);
      return {
        vendor,
        orders: vos.length,
        ...money(todayLedger.filter((e) => e.vendorId === vendor.id)),
        avgPrepSeconds: avg(vos.map(prepSeconds).filter((x): x is number => x !== null)),
      };
    }),
    recentOrders: orders.filter((o) => o.status !== "submitting").slice(0, 8),
  };
}

export async function panelOrders(
  venue: Venue,
  vendorIds: string[],
  q: { range: VendorRange; status?: VendorOrderStatus; search?: string; page: number; limit: number },
): Promise<VendorOrderListResponse> {
  const w = rangeWindow(RANGE_DAYS[q.range], venue.timezone);
  const needle = q.search?.trim().toLowerCase();
  const rows = (await ordersIn(vendorIds, w.floor)).filter(
    (o) =>
      o.status !== "submitting" &&
      w.set.has(dateKey(o.createdAt, venue.timezone)) &&
      (!q.status || o.status === q.status) &&
      (!needle || o.pickupCode.toLowerCase().includes(needle) || o.tableLabel.toLowerCase().includes(needle) || (o.guestFirstName ?? "").toLowerCase().includes(needle)),
  );
  return { rows: rows.slice(q.page * q.limit, (q.page + 1) * q.limit), count: rows.length, page: q.page, limit: q.limit };
}

export async function panelPayments(venue: Venue, vendorIds: string[], range: VendorRange): Promise<VendorPaymentsResponse> {
  const w = rangeWindow(RANGE_DAYS[range], venue.timezone);
  const ledger = (await ledgerIn(vendorIds, w.floor)).filter((e) => w.set.has(dateKey(e.createdAt, venue.timezone)));
  const c = await db();
  const vos = await c.vendorOrders
    .find({ id: { $in: [...new Set(ledger.map((e) => e.vendorOrderId))] } }, { projection: { _id: 0, id: 1, pickupCode: 1, tableLabel: 1 } })
    .toArray();
  const byId = new Map(vos.map((v) => [v.id, v]));
  return {
    currency: venue.currency,
    entries: ledger.map((e) => ({ ...e, pickupCode: byId.get(e.vendorOrderId)?.pickupCode ?? "—", tableLabel: byId.get(e.vendorOrderId)?.tableLabel ?? "—" })),
    totals: { ...money(ledger), sales: ledger.filter((e) => e.type === "sale").length, reversals: ledger.filter((e) => e.type === "reversal").length },
  };
}

export async function panelReports(venue: Venue, vendors: Vendor[], range: VendorRange): Promise<VendorReportsResponse> {
  const ids = vendors.map((v) => v.id);
  const w = rangeWindow(RANGE_DAYS[range], venue.timezone);
  const tz = venue.timezone;
  const [orders, ledger] = await Promise.all([ordersIn(ids, w.floor), ledgerIn(ids, w.floor)]);
  const okOrders = orders.filter((o) => DONE_OR_LIVE.includes(o.status) && w.set.has(dateKey(o.createdAt, tz)));
  const inRange = ledger.filter((e) => w.set.has(dateKey(e.createdAt, tz)));

  const items = new Map<string, { name: string; vendorId: string; qty: number; grossMinor: number }>();
  for (const o of okOrders) {
    for (const it of o.items) {
      const k = `${o.vendorId}:${it.menuItemId}`;
      const cur = items.get(k) ?? { name: it.name, vendorId: o.vendorId, qty: 0, grossMinor: 0 };
      cur.qty += it.qty;
      cur.grossMinor += it.lineTotalMinor;
      items.set(k, cur);
    }
  }
  return {
    currency: venue.currency,
    days: w.keys.map((date) => ({
      date,
      orders: okOrders.filter((o) => dateKey(o.createdAt, tz) === date).length,
      ...money(inRange.filter((e) => dateKey(e.createdAt, tz) === date)),
    })),
    topItems: [...items.values()].sort((a, b) => b.qty - a.qty || b.grossMinor - a.grossMinor).slice(0, 10),
    byVendor: vendors.map((vendor) => ({
      vendor,
      orders: okOrders.filter((o) => o.vendorId === vendor.id).length,
      ...money(inRange.filter((e) => e.vendorId === vendor.id)),
    })),
  };
}

/** Tables a session can see: the venue's shared QRs plus the in-scope vendors' own QRs. */
export async function panelTables(venue: Venue, vendorIds: string[], allVendors: boolean): Promise<VendorTablesResponse> {
  const c = await db();
  const filter = allVendors ? { venueId: venue.id } : { venueId: venue.id, $or: [{ vendorId: null }, { vendorId: { $in: vendorIds } }] };
  const [tables, open] = await Promise.all([
    c.tables.find(filter, NO_ID).toArray(),
    c.vendorOrders.find({ vendorId: { $in: vendorIds }, status: { $in: BOARD } }, { projection: { _id: 0, tableLabel: 1 } }).toArray(),
  ]);
  const openByLabel = new Map<string, number>();
  for (const o of open) openByLabel.set(o.tableLabel, (openByLabel.get(o.tableLabel) ?? 0) + 1);
  tables.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  return {
    tables: tables.map((t) => ({ ...t, url: `${config.publicCustomerUrl}/t/${t.qrToken}`, openOrders: openByLabel.get(t.label) ?? 0 })),
  };
}

/**
 * Pull the vendor's floor plan from its POS (GetFloorPlan) and make sure every POS table has a QR.
 * A single restaurant's tables are the venue's own (shared) QRs; in a multivendor venue they become
 * that vendor's QRs. Existing tables are matched by POS id, then by name — never duplicated.
 */
export async function syncTablesFromPos(venue: Venue, vendor: Vendor): Promise<TableSyncResponse> {
  if (vendor.posMode !== "mock_pos") throw new AppError("VALIDATION_ERROR", 400, `${vendor.name} uses a tablet — there is no POS floor plan to sync`);
  let posTables;
  try {
    posTables = await mockPosAdapter.getFloorPlan(vendor);
  } catch (err) {
    throw new AppError("POS_ERROR", 502, `Couldn't read tables from the POS (${err instanceof PosError ? err.message : "error"})`);
  }
  const c = await db();
  const owner = venue.type === "restaurant" ? null : vendor.id;
  const existing = await c.tables.find({ venueId: venue.id, vendorId: owner }, NO_ID).toArray();
  const byPosId = new Set(existing.map((t) => t.posTableId).filter(Boolean));
  const unlinkedByLabel = new Map(existing.filter((t) => !t.posTableId).map((t) => [t.label.toLowerCase(), t]));
  let created = 0;
  let linked = 0;
  for (const pt of posTables) {
    if (byPosId.has(pt.posTableId)) continue;
    const match = unlinkedByLabel.get(pt.name.toLowerCase());
    if (match) {
      await c.tables.updateOne({ id: match.id }, { $set: { posTableId: pt.posTableId } });
      unlinkedByLabel.delete(pt.name.toLowerCase());
      linked++;
      continue;
    }
    await c.tables.insertOne({ id: newId("tbl"), venueId: venue.id, label: pt.name, qrToken: newQrToken(), vendorId: owner, posTableId: pt.posTableId });
    created++;
  }
  return { vendorId: vendor.id, posTables: posTables.length, created, linked };
}
