import { Hono } from "hono";
import { CheckoutRequest, QuoteRequest, type MenuCategory, type MenuResponse, type QuoteResponse, type TableResolveResponse } from "@one/contracts";
import { db, NO_ID } from "@one/db";
import { ensureGuestToken, getGuestToken } from "../lib/auth";
import { AppError, notFound, parse } from "../lib/errors";
import { channel, sseResponse } from "../lib/events";
import { checkout, quote } from "../services/checkout";
import { getVenue, listMenuItems, listVendors, loadOrderResponse } from "../services/repo";

export const customer = new Hono();

/** Resolve a scanned QR → venue, table, vendors. Sets the anonymous guestToken cookie. */
customer.get("/t/:qrToken", async (c) => {
  const db_ = await db();
  const table = await db_.tables.findOne({ qrToken: c.req.param("qrToken") }, NO_ID);
  if (!table) throw new AppError("QR_NOT_FOUND", 404, "This QR isn't active. Ask staff for help.");
  const venue = await getVenue(table.venueId);
  ensureGuestToken(c);
  const body: TableResolveResponse = { venue, table, vendors: await listVendors(venue.id) };
  return c.json(body);
});

/** Merged menu: every vendor, categories in POS order. */
customer.get("/venues/:venueId/menu", async (c) => {
  const venue = await getVenue(c.req.param("venueId"));
  if (venue.status !== "live") throw new AppError("VENUE_NOT_LIVE", 409, "Opening soon");
  const vendors = await listVendors(venue.id);
  const items = await listMenuItems(vendors.map((v) => v.id));
  const body: MenuResponse = {
    venue,
    vendors: vendors.map((vendor) => {
      const categories: MenuCategory[] = [];
      for (const it of items.filter((i) => i.vendorId === vendor.id)) {
        let cat = categories.find((x) => x.name === it.category);
        if (!cat) categories.push((cat = { name: it.category, items: [] }));
        cat.items.push(it);
      }
      return { vendor, categories };
    }),
  };
  c.header("Cache-Control", "no-store");
  return c.json(body);
});

customer.post("/checkout/quote", async (c) => {
  const req = parse(QuoteRequest, await c.req.json().catch(() => null));
  const { priced, venue } = await quote(req);
  const body: QuoteResponse = { ...priced, currency: venue.currency };
  return c.json(body);
});

customer.post("/checkout", async (c) => {
  const req = parse(CheckoutRequest, await c.req.json().catch(() => null));
  const guestToken = ensureGuestToken(c);
  const result = await checkout(req, guestToken);
  return c.json(result, 201);
});

customer.get("/orders/:masterOrderId", async (c) => {
  const token = getGuestToken(c);
  if (!token) throw notFound("Order");
  return c.json(await loadOrderResponse(c.req.param("masterOrderId"), token));
});

customer.get("/orders/:masterOrderId/stream", async (c) => {
  const token = getGuestToken(c);
  if (!token) throw notFound("Order");
  const { masterOrder } = await loadOrderResponse(c.req.param("masterOrderId"), token); // ownership check
  return sseResponse(c, channel.order(masterOrder.id));
});
