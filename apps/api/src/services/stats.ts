import type { DashboardResponse, SettlementsResponse, Vendor, VendorOrder, VendorStats } from "@one/contracts";
import { db, NO_ID } from "@one/db";
import { config } from "../config";
import { isToday, todayQueryFloor } from "../lib/time";
import { getVenue, listVendors } from "./repo";

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const prepSeconds = (o: VendorOrder) => (o.readyAt ? Math.max(0, (new Date(o.readyAt).getTime() - new Date(o.createdAt).getTime()) / 1000) : null);

export async function dashboard(venueId: string): Promise<DashboardResponse> {
  const venue = await getVenue(venueId);
  const vendors = await listVendors(venueId);
  const c = await db();
  const floor = todayQueryFloor();
  const tz = venue.timezone;

  const [masters, vendorOrders, ledger] = await Promise.all([
    c.masterOrders.find({ venueId, createdAt: { $gte: floor } }, NO_ID).toArray(),
    c.vendorOrders.find({ venueId, createdAt: { $gte: floor } }, NO_ID).sort({ createdAt: -1 }).toArray(),
    c.settlements.find({ venueId, createdAt: { $gte: floor } }, NO_ID).toArray(),
  ]);
  const todayMasters = masters.filter((m) => isToday(m.createdAt, tz) && ["paid", "partially_failed", "completed"].includes(m.status));
  const todayVos = (vendorOrders as VendorOrder[]).filter((v) => isToday(v.createdAt, tz));
  const todayLedger = ledger.filter((e) => isToday(e.createdAt, tz));

  const byVendor: VendorStats[] = vendors.map((vendor: Vendor) => {
    const entries = todayLedger.filter((e) => e.vendorId === vendor.id);
    const vos = todayVos.filter((v) => v.vendorId === vendor.id && v.status !== "failed" && v.status !== "submitting");
    return {
      vendor,
      orders: vos.length,
      grossMinor: entries.reduce((a, e) => a + e.grossMinor, 0),
      feeMinor: entries.reduce((a, e) => a + e.feeMinor, 0),
      netMinor: entries.reduce((a, e) => a + e.netMinor, 0),
      avgPrepSeconds: avg(vos.map(prepSeconds).filter((x): x is number => x !== null)),
    };
  });

  return {
    venue,
    currency: venue.currency,
    ordersToday: todayMasters.length,
    gmvMinor: todayLedger.reduce((a, e) => a + e.grossMinor, 0),
    avgPrepSeconds: avg(todayVos.map(prepSeconds).filter((x): x is number => x !== null)),
    activeVendors: vendors.filter((v) => v.isOpen).length,
    totalVendors: vendors.length,
    setupDurationMs: venue.setupDurationMs,
    baselineMinPerVendor: config.baselineMinPerVendor,
    byVendor,
    recentOrders: todayVos.slice(0, 10),
    failures: todayVos.filter((v) => v.status === "failed"),
  };
}

export async function settlements(venueId: string, filter: { vendorId?: string; type?: "sale" | "reversal" }): Promise<SettlementsResponse> {
  const venue = await getVenue(venueId);
  const vendors = await listVendors(venueId);
  const c = await db();
  const all = await c.settlements.find({ venueId }, NO_ID).sort({ createdAt: -1 }).toArray();
  const vos = await c.vendorOrders
    .find({ id: { $in: [...new Set(all.map((e) => e.vendorOrderId))] } }, { projection: { _id: 0, id: 1, pickupCode: 1 } })
    .toArray();
  const codes = new Map(vos.map((v) => [v.id, v.pickupCode]));

  const sum = (xs: typeof all) => ({
    grossMinor: xs.reduce((a, e) => a + e.grossMinor, 0),
    feeMinor: xs.reduce((a, e) => a + e.feeMinor, 0),
    netMinor: xs.reduce((a, e) => a + e.netMinor, 0),
  });
  const totals = sum(all);
  const entries = all
    .filter((e) => (!filter.vendorId || e.vendorId === filter.vendorId) && (!filter.type || e.type === filter.type))
    .map((e) => ({ ...e, pickupCode: codes.get(e.vendorOrderId) ?? "—" }));

  return {
    currency: venue.currency,
    entries,
    byVendor: vendors.map((vendor) => ({ vendor, ...sum(all.filter((e) => e.vendorId === vendor.id)) })),
    totals,
    balanced: totals.netMinor + totals.feeMinor === totals.grossMinor,
  };
}
