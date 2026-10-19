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
      id: ids.venue, name: "Test Hall", slug: "test-hall", code: "TESTHALL", type: "food_court", currency: "AED",
      timezone: "Asia/Dubai", feeBps: 100, status: "live", setupDurationMs: 1000, createdAt: now,
    });
    await c.tables.insertOne({ id: ids.table, venueId: ids.venue, label: "T1", qrToken });
    const pinHash = await bcrypt.hash("1234", 4);
    await c.vendors.insertMany([
      { id: ids.a, venueId: ids.venue, name: "Alpha", slug: "alpha", letter: "A", emoji: "🅰️", accentToken: "vendor-1", posMode: "tablet", posVendorId: null, isOpen: true, sortOrder: 0, pinHash },
      { id: ids.b, venueId: ids.venue, name: "Bravo", slug: "bravo", letter: "B", emoji: "🅱️", accentToken: "vendor-2", posMode: "tablet", posVendorId: null, isOpen: true, sortOrder: 1, pinHash },
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
});
