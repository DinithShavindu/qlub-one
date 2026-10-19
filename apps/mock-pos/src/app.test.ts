import { beforeEach, describe, expect, it } from "vitest";
import { app } from "./app";
import { loadSeed, state } from "./store";

const H = { "content-type": "application/json", "x-pos-key": "pos_sushi-key" };
const post = (path: string, body: unknown, headers: Record<string, string> = H) =>
  app.request(path, { method: "POST", headers, body: JSON.stringify(body) });

beforeEach(() => {
  process.env.MOCK_POS_LATENCY_MS = "0";
  process.env.MOCK_POS_FAILURE_RATE = "0";
  loadSeed();
});

describe("mock-pos", () => {
  it("rejects a wrong key", async () => {
    const res = await app.request("/pos/pos_sushi/menu", { headers: { "x-pos-key": "nope" } });
    expect(res.status).toBe(401);
  });

  it("serves the menu with string decimal prices", async () => {
    const res = await app.request("/pos/pos_sushi/menu", { headers: H });
    const body = (await res.json()) as { groups: { products: { price: string }[] }[] };
    expect(typeof body.groups[0]!.products[0]!.price).toBe("string");
  });

  it("creates a check, totals it, and is idempotent on externalRef", async () => {
    const order = { externalRef: "vo_1", tableName: "T1", items: [{ sku: "su_001", quantity: 2 }, { sku: "su_013", quantity: 1 }] };
    const a = await post("/pos/pos_sushi/checks", order);
    expect(a.status).toBe(201);
    const ca = (await a.json()) as { checkId: string; total: string; checkNumber: number };
    expect(ca.total).toBe("65.00");
    expect(ca.checkNumber).toBe(1001);
    const b = await post("/pos/pos_sushi/checks", order);
    const cb = (await b.json()) as { checkId: string };
    expect(cb.checkId).toBe(ca.checkId);
    expect(state.checks.get("pos_sushi")!.size).toBe(1);
  });

  it("422s on sold-out SKUs", async () => {
    await post("/pos/pos_sushi/items/su_001/sold-out", { soldOut: true });
    const res = await post("/pos/pos_sushi/checks", { externalRef: "x", items: [{ sku: "su_001", quantity: 1 }] });
    expect(res.status).toBe(422);
  });

  it("tenders mark the check PAID", async () => {
    const c = (await (await post("/pos/pos_sushi/checks", { externalRef: "y", items: [{ sku: "su_013", quantity: 1 }] })).json()) as { checkId: string };
    const t = await post(`/pos/pos_sushi/checks/${c.checkId}/tenders`, { amount: "9.00", tenderType: "QLUB", reference: "mockpay_1" });
    expect(((await t.json()) as { status: string }).status).toBe("PAID");
  });

  it("down → 503", async () => {
    await post("/admin/chaos", { posVendorId: "pos_sushi", down: true }, { "content-type": "application/json" });
    const res = await app.request("/pos/pos_sushi/menu", { headers: H });
    expect(res.status).toBe(503);
  });
});
