import { Hono, type Context, type Next } from "hono";
import { streamSSE } from "hono/streaming";
import {
  emitChange,
  events,
  findProduct,
  newCheckId,
  paidCents,
  serializeCheck,
  state,
  toCents,
  toDecimal,
  type Check,
  type CheckStatus,
} from "./store";
import { renderUi } from "./ui";

const envLatency = () => Number(process.env.MOCK_POS_LATENCY_MS ?? 0) || 0;
const envFailureRate = () => Number(process.env.MOCK_POS_FAILURE_RATE ?? 0) || 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Env = { Variables: { posVendorId: string } };
export const app = new Hono<Env>();

/* one line per request: [pos_sushi] POST /checks 201 54.00 (312ms) */
app.use("*", async (c, next) => {
  const t0 = Date.now();
  await next();
  if (c.req.path.startsWith("/ui")) return;
  const m = /^\/pos\/([^/]+)(\/.*)?$/.exec(c.req.path);
  const tag = m && m[1] !== "vendors" ? `[${m[1]}]` : "[mock-pos]";
  const rest = m && m[1] !== "vendors" ? m[2] ?? "/" : c.req.path;
  const total = c.res.headers.get("x-check-total");
  console.log(`${tag} ${c.req.method} ${rest} ${c.res.status}${total ? " " + total : ""} (${Date.now() - t0}ms)`);
});

app.get("/", (c) => c.redirect("/ui"));
app.get("/health", (c) => c.json({ ok: true }));

/* ── vendor directory (no auth: it's the POS company's public listing) ── */
app.get("/pos/vendors", (c) =>
  c.json([...state.restaurants.values()].map((r) => ({ posVendorId: r.posVendorId, displayName: r.displayName, emoji: r.emoji }))),
);

/* ── per-restaurant middleware: auth, chaos, latency ── */
async function restaurantGuard(c: Context<Env>, next: Next) {
  const id = c.req.param("posVendorId")!;
  if (!state.restaurants.has(id)) return c.json({ code: "UNKNOWN_RESTAURANT", message: `No restaurant ${id}` }, 404);
  if (c.req.header("x-pos-key") !== `${id}-key`) return c.json({ code: "BAD_KEY", message: "Invalid X-Pos-Key" }, 401);
  const chaos = state.chaos.get(id)!;
  const latency = chaos.latencyMs ?? envLatency();
  if (latency > 0) await sleep(latency);
  if (chaos.down) return c.json({ code: "SERVICE_UNAVAILABLE", message: "Restaurant POS is offline" }, 503);
  if (chaos.failNextRequests > 0) {
    chaos.failNextRequests -= 1;
    emitChange("chaos", id);
    return c.json({ code: "INTERNAL", message: "Simulated POS failure" }, 500);
  }
  if (envFailureRate() > 0 && Math.random() < envFailureRate()) {
    return c.json({ code: "INTERNAL", message: "Random POS failure (MOCK_POS_FAILURE_RATE)" }, 500);
  }
  c.set("posVendorId", id);
  await next();
}
app.use("/pos/:posVendorId/*", restaurantGuard);

app.get("/pos/:posVendorId/menu", (c) => {
  const r = state.restaurants.get(c.get("posVendorId"))!;
  return c.json({ store: { id: r.posVendorId, ...r.store }, groups: r.groups });
});

app.post("/pos/:posVendorId/checks", async (c) => {
  const id = c.get("posVendorId");
  const r = state.restaurants.get(id)!;
  const body = (await c.req.json().catch(() => null)) as {
    externalRef?: string;
    tableName?: string;
    items?: { sku?: string; quantity?: number; remark?: string | null }[];
  } | null;
  if (!body?.externalRef || !Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ code: "BAD_REQUEST", message: "externalRef and items are required" }, 400);
  }
  const existingId = state.byExternalRef.get(`${id}:${body.externalRef}`);
  if (existingId) {
    const existing = state.checks.get(id)!.get(existingId)!;
    c.header("x-check-total", toDecimal(existing.totalCents));
    return c.json(serializeCheck(existing), 200); // idempotent replay
  }
  const items: Check["items"] = [];
  for (const it of body.items) {
    const p = it.sku ? findProduct(r, it.sku) : undefined;
    if (!p || p.soldOut) return c.json({ code: "SKU_UNAVAILABLE", sku: it.sku ?? null, message: `SKU ${it.sku} unavailable` }, 422);
    const q = Number(it.quantity);
    if (!Number.isInteger(q) || q < 1) return c.json({ code: "BAD_REQUEST", message: "quantity must be a positive integer" }, 400);
    items.push({ sku: p.sku, title: p.title, quantity: q, remark: it.remark || null, priceCents: toCents(p.price) });
  }
  const now = new Date().toISOString();
  const checkNumber = state.nextCheckNumber.get(id)!;
  state.nextCheckNumber.set(id, checkNumber + 1);
  const check: Check = {
    checkId: newCheckId(),
    checkNumber,
    posVendorId: id,
    externalRef: body.externalRef,
    tableName: body.tableName ?? "",
    items,
    totalCents: items.reduce((a, i) => a + i.priceCents * i.quantity, 0),
    status: "OPEN",
    tenders: [],
    createdAt: now,
    updatedAt: now,
  };
  state.checks.get(id)!.set(check.checkId, check);
  state.byExternalRef.set(`${id}:${body.externalRef}`, check.checkId);
  emitChange("check_created", id, check.checkId);
  c.header("x-check-total", toDecimal(check.totalCents));
  return c.json(serializeCheck(check), 201);
});

app.get("/pos/:posVendorId/checks/:checkId", (c) => {
  const check = state.checks.get(c.get("posVendorId"))!.get(c.req.param("checkId"));
  if (!check) return c.json({ code: "NOT_FOUND", message: "Check not found" }, 404);
  return c.json(serializeCheck(check));
});

app.post("/pos/:posVendorId/checks/:checkId/tenders", async (c) => {
  const id = c.get("posVendorId");
  const check = state.checks.get(id)!.get(c.req.param("checkId"));
  if (!check) return c.json({ code: "NOT_FOUND", message: "Check not found" }, 404);
  const body = (await c.req.json().catch(() => null)) as { amount?: string; tenderType?: string; reference?: string } | null;
  let cents: number;
  try {
    cents = toCents(String(body?.amount ?? ""));
  } catch {
    return c.json({ code: "BAD_REQUEST", message: "amount must be a decimal string" }, 400);
  }
  if (check.status === "VOID") return c.json({ code: "CHECK_VOID", message: "Check is void" }, 409);
  const ref = body?.reference ?? "";
  // idempotent: same reference twice doesn't double-tender
  if (!check.tenders.some((t) => t.reference === ref && ref)) {
    check.tenders.push({ amountCents: cents, tenderType: body?.tenderType ?? "OTHER", reference: ref, at: new Date().toISOString() });
  }
  if (paidCents(check) >= check.totalCents && check.status === "OPEN") check.status = "PAID";
  check.updatedAt = new Date().toISOString();
  emitChange("check_paid", id, check.checkId);
  c.header("x-check-total", toDecimal(check.totalCents));
  return c.json(serializeCheck(check));
});

app.post("/pos/:posVendorId/checks/:checkId/close", (c) => {
  const id = c.get("posVendorId");
  const check = state.checks.get(id)!.get(c.req.param("checkId"));
  if (!check) return c.json({ code: "NOT_FOUND", message: "Check not found" }, 404);
  check.status = "DONE";
  check.updatedAt = new Date().toISOString();
  emitChange("check_closed", id, check.checkId);
  return c.json(serializeCheck(check));
});

app.post("/pos/:posVendorId/items/:sku/sold-out", async (c) => {
  const r = state.restaurants.get(c.get("posVendorId"))!;
  const p = findProduct(r, c.req.param("sku"));
  if (!p) return c.json({ code: "NOT_FOUND", message: "SKU not found" }, 404);
  const body = (await c.req.json().catch(() => ({}))) as { soldOut?: boolean };
  p.soldOut = Boolean(body.soldOut);
  emitChange("menu", r.posVendorId);
  return c.json({ sku: p.sku, soldOut: p.soldOut });
});

/* ── chaos + reset (demo driver) ── */
app.post("/admin/chaos", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    posVendorId?: string;
    latencyMs?: number | null;
    failNextRequests?: number;
    down?: boolean;
  } | null;
  const chaos = body?.posVendorId ? state.chaos.get(body.posVendorId) : undefined;
  if (!chaos) return c.json({ code: "NOT_FOUND", message: "Unknown posVendorId" }, 404);
  if (body!.latencyMs !== undefined) chaos.latencyMs = body!.latencyMs === null ? null : Math.max(0, Math.min(10_000, Number(body!.latencyMs) || 0));
  if (body!.failNextRequests !== undefined) chaos.failNextRequests = Math.max(0, Number(body!.failNextRequests) || 0);
  if (body!.down !== undefined) chaos.down = Boolean(body!.down);
  emitChange("chaos", body!.posVendorId);
  console.log(`[mock-pos] chaos ${body!.posVendorId} ${JSON.stringify(chaos)}`);
  return c.json({ posVendorId: body!.posVendorId, ...chaos });
});

/* ── POS screen UI ── */
app.get("/ui", (c) => c.html(renderUi()));

app.get("/ui/state", (c) =>
  c.json({
    envLatencyMs: envLatency(),
    restaurants: [...state.restaurants.values()].map((r) => ({
      posVendorId: r.posVendorId,
      displayName: r.displayName,
      emoji: r.emoji,
      chaos: state.chaos.get(r.posVendorId),
      soldOut: r.groups.flatMap((g) => g.products.filter((p) => p.soldOut).map((p) => p.sku)),
      checks: [...state.checks.get(r.posVendorId)!.values()].sort((a, b) => b.checkNumber - a.checkNumber).map(serializeCheck),
    })),
  }),
);

app.get("/ui/stream", (c) =>
  streamSSE(c, async (stream) => {
    const onChange = (e: unknown) => void stream.writeSSE({ event: "change", data: JSON.stringify(e) });
    events.on("change", onChange);
    const hb = setInterval(() => void stream.writeSSE({ event: "heartbeat", data: "{}" }), 15_000);
    stream.onAbort(() => {
      events.off("change", onChange);
      clearInterval(hb);
    });
    await new Promise<void>((resolve) => stream.onAbort(resolve));
  }),
);

/** Kitchen on the POS screen moves a check → optional webhook to qlub (stretch, §6). */
app.post("/ui/checks/:posVendorId/:checkId/status", async (c) => {
  const id = c.req.param("posVendorId");
  const check = state.checks.get(id)?.get(c.req.param("checkId"));
  if (!check) return c.json({ code: "NOT_FOUND", message: "Check not found" }, 404);
  const { status } = (await c.req.json().catch(() => ({}))) as { status?: CheckStatus };
  if (!status || !["IN_KITCHEN", "DONE", "VOID"].includes(status)) return c.json({ code: "BAD_REQUEST", message: "bad status" }, 400);
  check.status = status;
  check.updatedAt = new Date().toISOString();
  emitChange("check_status", id, check.checkId);
  const url = process.env.WEBHOOK_URL;
  if (url) {
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ posVendorId: id, checkId: check.checkId, status }),
      signal: AbortSignal.timeout(3000),
    })
      .then((r) => console.log(`[${id}] webhook ${status} → ${r.status}`))
      .catch((err) => console.log(`[${id}] webhook failed: ${String(err)}`));
  }
  return c.json(serializeCheck(check));
});
