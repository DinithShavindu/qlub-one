/** Small typed loaders. Everything returned here is safe to send to clients (no _id, no pinHash). */
import type { MasterOrder, MenuItem, OrderResponse, Table, Vendor, VendorOrder, Venue } from "@one/contracts";
import { db, NO_ID, strip, type MasterOrderDoc, type VendorDoc } from "@one/db";
import { notFound } from "../lib/errors";

export const toVendor = (d: VendorDoc): Vendor => strip(d, "pinHash");
export const toMasterOrder = (d: MasterOrderDoc): MasterOrder => strip(d, "guestToken", "idempotencyKey");

export async function getVenue(id: string): Promise<Venue> {
  const c = await db();
  const v = await c.venues.findOne({ id }, NO_ID);
  if (!v) throw notFound("Venue");
  return v;
}

export async function getVendorDoc(id: string): Promise<VendorDoc> {
  const c = await db();
  const v = await c.vendors.findOne({ id }, NO_ID);
  if (!v) throw notFound("Vendor");
  return v;
}

export async function listVendors(venueId: string): Promise<Vendor[]> {
  const c = await db();
  const docs = await c.vendors.find({ venueId }, NO_ID).sort({ sortOrder: 1 }).toArray();
  return docs.map(toVendor);
}

export async function listMenuItems(vendorIds: string[]): Promise<MenuItem[]> {
  const c = await db();
  return c.menuItems.find({ vendorId: { $in: vendorIds } }, NO_ID).sort({ sortOrder: 1 }).toArray();
}

export async function getTable(id: string): Promise<Table> {
  const c = await db();
  const t = await c.tables.findOne({ id }, NO_ID);
  if (!t) throw notFound("Table");
  return t;
}

export async function loadOrderResponse(masterOrderId: string, guestToken?: string | null): Promise<OrderResponse> {
  const c = await db();
  const mo = await c.masterOrders.findOne({ id: masterOrderId }, NO_ID);
  // a guest only ever sees their own order; don't leak existence either
  if (!mo || (guestToken !== undefined && mo.guestToken !== guestToken)) throw notFound("Order");
  const vendorOrders = await c.vendorOrders.find({ masterOrderId }, NO_ID).sort({ createdAt: 1 }).toArray();
  const vendorDocs = await c.vendors.find({ id: { $in: vendorOrders.map((v) => v.vendorId) } }, NO_ID).toArray();
  const byId = new Map(vendorDocs.map((v) => [v.id, toVendor(v)]));
  const vendors = [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  // keep vendor orders in the same order as vendors for a stable tracker
  vendorOrders.sort((a, b) => (byId.get(a.vendorId)?.sortOrder ?? 0) - (byId.get(b.vendorId)?.sortOrder ?? 0));
  return { masterOrder: toMasterOrder(mo), vendorOrders: vendorOrders as VendorOrder[], vendors };
}
