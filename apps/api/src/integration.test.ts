/**
 * Integration tests against a real MongoDB (separate `<db>_test` database, dropped before and after).
 * Uses tablet vendors only, so mock-pos does not need to be running.
 * Skipped when MONGODB_URI is not configured.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { loadEnv } from "@one/db";

loadEnv();
process.env.MONGODB_DB = `${process.env.MONGODB_DB ?? "qlub_one"}_test`;
const hasDb = !!process.env.MONGODB_URI;

type Fetcher = (path: string, init?: { method?: string; json?: unknown }) => Promise<{ status: number; body: any }>;

describe.skipIf(!hasDb)("api integration (MongoDB)", async () => {
  const { app } = await import("./app");
  const { db, getDb, ensureIndexes, closeDb, newId, newQrToken } = await import("@one/db");

  const ids = { venue: newId("ven"), table: newId("tbl"), a: newId("vdr"), b: newId("vdr"), itemA: newId("itm"), itemB: newId("itm") };

  function client(): Fetcher {
    const jar = new Map<string, string>();
    return async (path, init = {}) => {
      const res = await app.request(`/v1${path}`, {
        method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
        headers: { "content-type": "application/json", cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
        body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
      });
      for (const sc of res.headers.getSetCookie()) {
        const [kv] = sc.split(";");
        const i = kv!.indexOf("=");
        jar.set(kv!.slice(0, i), kv!.slice(i + 1));
      }
      return { status: res.status, body: await res.json().catch(() => null) };
    };
  }

  const qrToken = newQrToken();
  beforeAll(async () => {
    await (await getDb()).dropDatabase();
    await ensureIndexes();
    const c = await db();
    const now = new Date().toISOString();
    await c.venues.insertOne({
      id: ids.venue, name: "Test Hall", slug: "test-hall", code: "TESTHALL", type: "food_court", flow: "qsr", gateway: "qlub_test", gatewayMerchantId: null, currency: "AED",
      timezone: "Asia/Dubai", feeBps: 100, status: "live", setupDurationMs: 1000, createdAt: now,
    });
    await c.tables.insertOne({ id: ids.table, venueId: ids.venue, label: "T1", qrToken });
    const pinHash = await bcrypt.hash("1234", 4);
    await c.vendors.insertMany([
      { id: ids.a, venueId: ids.venue, name: "Alpha", slug: "alpha", letter: "A", emoji: "🅰️", accentToken: "vendor-1", posMode: "tablet", posVendorId: null, isOpen: true, sortOrder: 0, feeBps: null, pinHash },
      { id: ids.b, venueId: ids.venue, name: "Bravo", slug: "bravo", letter: "B", emoji: "🅱️", accentToken: "vendor-2", posMode: "tablet", posVendorId: null, isOpen: true, sortOrder: 1, feeBps: null, pinHash },
    ]);
    await c.menuItems.insertMany([
      { id: ids.itemA, vendorId: ids.a, posItemId: "a1", name: "Odd item", description: "", category: "Mains", priceMinor: 1005, imageUrl: null, available: true, sortOrder: 0, syncedAt: now },
      { id: ids.itemB, vendorId: ids.b, posItemId: "b1", name: "Bravo bowl", description: "", category: "Mains", priceMinor: 4200, imageUrl: null, available: true, sortOrder: 0, syncedAt: now },
    ]);
  });

  afterAll(async () => {
    await (await getDb()).dropDatabase();
    await closeDb();
  });

  const lines = () => [
    { menuItemId: ids.itemA, qty: 1 },
    { menuItemId: ids.itemB, qty: 2 },
  ];

  it("checkout splits one payment into per-vendor orders (Σ vendor === master, fee rounding)", async () => {
    const guest = client();
    expect((await guest(`/t/${qrToken}`)).status).toBe(200);
    const res = await guest("/checkout", { json: { venueId: ids.venue, tableId: ids.table, lines: lines(), paymentMethod: "test_card" } });
    expect(res.status).toBe(201);
    const { masterOrder, vendorOrders } = res.body;
    expect(masterOrder.status).toBe("paid");
    expect(vendorOrders).toHaveLength(2);
    expect(vendorOrders.reduce((a: number, v: any) => a + v.subtotalMinor, 0)).toBe(masterOrder.subtotalMinor);
    const alpha = vendorOrders.find((v: any) => v.vendorId === ids.a);
    expect(alpha).toMatchObject({ subtotalMinor: 1005, feeMinor: 10, netMinor: 995, status: "new" });
  });

  it("vendor A cannot read or change vendor B's orders", async () => {
    const guest = client();
    await guest(`/t/${qrToken}`);
    const order = (await guest("/checkout", { json: { venueId: ids.venue, tableId: ids.table, lines: lines(), paymentMethod: "test_card" } })).body;
    const bOrder = order.vendorOrders.find((v: any) => v.vendorId === ids.b);

    const a = client();
    expect((await a("/vendor/login", { json: { vendorId: ids.a, pin: "1234" } })).status).toBe(200);
    const aList = (await a("/vendor/orders")).body.vendorOrders as any[];
    expect(aList.length).toBeGreaterThan(0);
    expect(aList.every((o) => o.vendorId === ids.a)).toBe(true);
    expect(aList.some((o) => o.id === bOrder.id)).toBe(false);
    // even with B's order id in hand, A gets "not found"
    expect((await a(`/vendor/orders/${bOrder.id}/status`, { json: { status: "preparing" } })).status).toBe(404);
    // and a forged vendorId in the body is ignored (schema only accepts status)
    expect((await a(`/vendor/orders/${bOrder.id}/status`, { json: { status: "preparing", vendorId: ids.b } })).status).toBe(404);

    const b = client();
    await b("/vendor/login", { json: { vendorId: ids.b, pin: "1234" } });
    expect((await b(`/vendor/orders/${bOrder.id}/status`, { json: { status: "preparing" } })).body.status).toBe("preparing");
  });

  it("no session → 401; wrong PIN → 401", async () => {
    const anon = client();
    expect((await anon("/vendor/orders")).status).toBe(401);
    expect((await anon("/vendor/login", { json: { vendorId: ids.a, pin: "9999" } })).body.error.code).toBe("WRONG_PIN");
  });

  it("a failed vendor is refunded and its ledger nets to zero", async () => {
    const guest = client();
    await guest(`/t/${qrToken}`);
    const res = await guest("/checkout", {
      json: { venueId: ids.venue, tableId: ids.table, lines: lines(), paymentMethod: "test_card", simulate: "fail_one_vendor" },
    });
    const failed = res.body.vendorOrders.filter((v: any) => v.status === "failed");
    expect(res.body.masterOrder.status).toBe("partially_failed");
    expect(failed).toHaveLength(1);
    expect(failed[0].refundedMinor).toBe(failed[0].subtotalMinor);
    const c = await db();
    const entries = await c.settlements.find({ vendorOrderId: failed[0].id }).toArray();
    expect(entries.map((e) => e.type).sort()).toEqual(["reversal", "sale"]);
    expect(entries.reduce((a, e) => a + e.grossMinor, 0)).toBe(0);
    expect(entries.reduce((a, e) => a + e.netMinor, 0)).toBe(0);
  });

  it("declined payment creates no vendor orders", async () => {
    const guest = client();
    await guest(`/t/${qrToken}`);
    const c = await db();
    const before = await c.vendorOrders.countDocuments({});
    const res = await guest("/checkout", { json: { venueId: ids.venue, tableId: ids.table, lines: lines(), paymentMethod: "test_card", simulate: "decline" } });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe("PAYMENT_DECLINED");
    expect(await c.vendorOrders.countDocuments({})).toBe(before);
  });

  it("a guest can only read their own order", async () => {
    const g1 = client();
    await g1(`/t/${qrToken}`);
    const order = (await g1("/checkout", { json: { venueId: ids.venue, tableId: ids.table, lines: lines(), paymentMethod: "test_card" } })).body;
    const g2 = client();
    await g2(`/t/${qrToken}`);
    expect((await g1(`/orders/${order.masterOrder.id}`)).status).toBe(200);
    expect((await g2(`/orders/${order.masterOrder.id}`)).status).toBe(404);
  });

  it("settlement ledger balances", async () => {
    const admin = client();
    await admin("/admin/login", { json: { password: process.env.ADMIN_PASSWORD ?? "demo" } });
    const s = (await admin(`/admin/venues/${ids.venue}/settlements`)).body;
    expect(s.balanced).toBe(true);
    expect(s.totals.netMinor + s.totals.feeMinor).toBe(s.totals.grossMinor);
  });

  /* ── admin: restaurants, multivendor QRs, flow, commission ── */

  async function adminClient() {
    const admin = client();
    await admin("/admin/login", { json: { password: process.env.ADMIN_PASSWORD ?? "demo" } });
    return admin;
  }

  it("creates a single restaurant in one call and keeps it to one vendor", async () => {
    const admin = await adminClient();
    const res = await admin("/admin/restaurants", { json: { name: "Solo Grill", emoji: "🔥", posMode: "tablet", tableCount: 3, feeBps: 150 } });
    expect(res.status).toBe(201);
    expect(res.body.venue).toMatchObject({ type: "restaurant", status: "live", flow: "qsr", gateway: "qlub_test", feeBps: 150 });
    expect(res.body.vendor.name).toBe("Solo Grill");
    expect(res.body.pin).toMatch(/^\d{4}$/);
    expect(res.body.itemCount).toBeGreaterThan(0);
    const venueId = res.body.venue.id;
    expect((await admin(`/admin/venues/${venueId}/tables`)).body.tables).toHaveLength(3);

    const second = await admin(`/admin/venues/${venueId}/vendors/bulk`, { json: { vendors: [{ name: "Extra", posMode: "tablet" }] } });
    expect(second.status).toBe(409);
    // PAT reads the bill from the POS — a tablet restaurant can't switch to it
    expect((await admin(`/admin/venues/${venueId}`, { method: "PATCH", json: { flow: "pat" } })).status).toBe(400);
    // renaming the restaurant's vendor renames the venue
    await admin(`/admin/vendors/${res.body.vendor.id}`, { method: "PATCH", json: { name: "Solo Grill & Bar" } });
    expect((await admin(`/admin/venues/${venueId}`)).body.venue.name).toBe("Solo Grill & Bar");
  });

  it("a pay-at-table venue refuses QSR ordering", async () => {
    const c = await db();
    const venueId = newId("ven");
    const tableId = newId("tbl");
    await c.venues.insertOne({
      id: venueId, name: "Bill Hall", slug: "bill-hall", code: "BILLHALL", type: "food_court", flow: "pat", gateway: "stripe", gatewayMerchantId: null,
      currency: "AED", timezone: "Asia/Dubai", feeBps: 100, status: "live", setupDurationMs: 1, createdAt: new Date().toISOString(),
    });
    await c.tables.insertOne({ id: tableId, venueId, label: "T1", qrToken: newQrToken() });
    const res = await client()("/checkout/quote", { json: { venueId, tableId, lines: [{ menuItemId: ids.itemA, qty: 1 }] } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("WRONG_FLOW");
  });

  it("vendor QRs open one vendor; the QR list filters combined / shared / per vendor", async () => {
    const admin = await adminClient();
    const created = await admin(`/admin/venues/${ids.venue}/tables`, { json: { count: 2, prefix: "A", vendorId: ids.a } });
    expect(created.status).toBe(201);
    const vendorQr = created.body.tables.find((t: { vendorId: string | null }) => t.vendorId === ids.a);

    const list = async (q: string) => (await admin(`/admin/qr/list?venue=TESTHALL${q}`)).body;
    expect((await list("")).count).toBe(3);
    expect((await list("&vendor=shared")).count).toBe(1);
    expect((await list("&vendor=individual")).count).toBe(2);
    const alpha = await list("&vendor=alpha");
    expect(alpha.count).toBe(2);
    expect(alpha.rows[0].vendor).toMatchObject({ id: ids.a, slug: "alpha" });
    expect((await admin("/admin/qr/list?venue=TESTHALL&vendor=nope")).status).toBe(400);

    const guest = client();
    const resolved = (await guest(`/t/${vendorQr.qrToken}`)).body;
    expect(resolved.vendors.map((v: { id: string }) => v.id)).toEqual([ids.a]);
    const quote = (await guest("/checkout/quote", { json: { venueId: ids.venue, tableId: vendorQr.id, lines: lines() } })).body;
    expect(quote.groups.map((g: { vendorId: string }) => g.vendorId)).toEqual([ids.a]);
    expect(quote.issues.map((i: { menuItemId: string }) => i.menuItemId)).toEqual([ids.itemB]);
  });

  it("a vendor commission override is used for its orders and the ledger still balances", async () => {
    const admin = await adminClient();
    expect((await admin(`/admin/vendors/${ids.a}`, { method: "PATCH", json: { feeBps: 250 } })).status).toBe(200);
    const guest = client();
    await guest(`/t/${qrToken}`);
    const order = (await guest("/checkout", { json: { venueId: ids.venue, tableId: ids.table, lines: lines(), paymentMethod: "test_card" } })).body;
    const byVendor = Object.fromEntries(order.vendorOrders.map((v: { vendorId: string; feeMinor: number }) => [v.vendorId, v.feeMinor]));
    expect(byVendor[ids.a]).toBe(25); // 1005 × 2.5% = 25.125 → 25
    expect(byVendor[ids.b]).toBe(84); // 8400 × 1% (venue default)
    expect((await admin(`/admin/venues/${ids.venue}/settlements`)).body.balanced).toBe(true);
    await admin(`/admin/vendors/${ids.a}`, { method: "PATCH", json: { feeBps: null } });
  });

  /* ── vendor panel: venue manager + scoped pages ── */

  it("a venue manager sees every vendor; a vendor only itself; ?vendorId can't escape the venue", async () => {
    const admin = await adminClient();
    const pinRes = await admin(`/admin/venues/${ids.venue}/manager-pin`, { json: {} });
    expect(pinRes.status).toBe(200);
    expect((await admin(`/admin/venues/${ids.venue}`)).body.hasManagerPin).toBe(true);
    expect((await client()(`/vendor/venues/TESTHALL`)).body.venue.hasManager).toBe(true);

    const guest = client();
    await guest(`/t/${qrToken}`);
    const order = (await guest("/checkout", { json: { venueId: ids.venue, tableId: ids.table, lines: lines(), paymentMethod: "test_card" } })).body;
    const aOrder = order.vendorOrders.find((v: { vendorId: string }) => v.vendorId === ids.a);

    const mgr = client();
    expect((await mgr("/vendor/login", { json: { venueId: ids.venue, pin: "0000" === pinRes.body.pin ? "1111" : "0000" } })).status).toBe(401);
    const me = (await mgr("/vendor/login", { json: { venueId: ids.venue, pin: pinRes.body.pin } })).body;
    expect(me.role).toBe("manager");
    expect(me.vendor).toBeNull();
    expect(me.vendors.map((v: { id: string }) => v.id).sort()).toEqual([ids.a, ids.b].sort());

    const board = (await mgr("/vendor/orders")).body.vendorOrders as { vendorId: string }[];
    expect(new Set(board.map((o) => o.vendorId))).toEqual(new Set([ids.a, ids.b]));
    const dash = (await mgr("/vendor/dashboard")).body;
    expect(dash.byVendor).toHaveLength(2);
    expect((await mgr(`/vendor/dashboard?vendorId=${ids.a}`)).body.byVendor).toHaveLength(1);
    expect((await mgr("/vendor/dashboard?vendorId=vdr_elsewhere")).status).toBe(404);
    // the manager moves vendor A's order on its behalf
    expect((await mgr(`/vendor/orders/${aOrder.id}/status`, { json: { status: "preparing" } })).body.status).toBe("preparing");

    const a = client();
    await a("/vendor/login", { json: { vendorId: ids.a, pin: "1234" } });
    expect((await a("/vendor/me")).body.role).toBe("vendor");
    // a vendor's ?vendorId is ignored — it still only sees itself
    const list = (await a(`/vendor/orders/list?range=7d&vendorId=${ids.b}`)).body;
    expect(list.count).toBeGreaterThan(0);
    expect(list.rows.every((o: { vendorId: string }) => o.vendorId === ids.a)).toBe(true);
    const reports = (await a("/vendor/reports?range=7d")).body;
    expect(reports.days).toHaveLength(7);
    expect(reports.byVendor.map((r: { vendor: { id: string } }) => r.vendor.id)).toEqual([ids.a]);
    const payments = (await a("/vendor/payments?range=today")).body;
    expect(payments.totals.netMinor + payments.totals.feeMinor).toBe(payments.totals.grossMinor);
    // tablet vendors have no POS to sync from
    expect((await a("/vendor/menu/sync", { json: {} })).status).toBe(400);
    expect((await a("/vendor/tables/sync", { json: {} })).status).toBe(400);
    // a manager must pick a vendor before syncing
    expect((await mgr("/vendor/menu/sync", { json: {} })).status).toBe(400);
  });
});
