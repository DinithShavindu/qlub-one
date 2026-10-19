# Mock Restaurant (Mock POS) — Design Spec

> A fake restaurant POS server that stands in for real POS systems. Hono, port **4100**.
> Read `/CLAUDE.md` and `/docs/ARCHITECTURE.md §5` first.

## 1. Why it exists

The demo must prove that orders land **in each restaurant's own POS**, the way real qlub
integrations do, without touching any real POS. `mock-pos` simulates several independent
restaurants, each behaving like a POS: it owns its menu, receives orders, records payments,
and shows a "POS screen" so the audience can see the order arrive.

It also lets us rehearse failure: latency, timeouts, sold-out items, one vendor down.

## 2. Restaurants (seed, all fictional)

| posVendorId | Name | Emoji | Letter | Menu size |
|---|---|---|---|---|
| `pos_shawarma` | Shawarma Station | 🌯 | S | ~14 items: wraps, plates, sides, drinks |
| `pos_sushi` | Sushi Corner | 🍣 | C | ~16 items: rolls, nigiri, bowls, miso |
| `pos_juice` | Fresh Press Juice | 🥤 | F | ~10 items: juices, smoothies, bowls |
| `pos_spare` | Noodle Bar | 🍜 | N | ~12 items — unused by default; for "add another vendor" live |

Burger Lab (tablet vendor) is NOT in mock-pos — it has no POS by design.

Prices in AED minor units, realistic (e.g. chicken shawarma 1,800 = AED 18.00). Item IDs stable (`sh_001`…) so re-syncs are idempotent.
Seed lives in `apps/mock-pos/seed/*.json` — one file per restaurant.

## 3. API (POS-style, deliberately NOT the same shape as qlub contracts)

Real POS APIs never match our model; the adapter in `apps/api` must map. Keep this different on purpose.

Auth: header `X-Pos-Key: <posVendorId>-key` (static, from seed). Wrong key → 401.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/pos/vendors` | – | `[{ posVendorId, displayName, emoji }]` (used by admin picker via api) |
| GET | `/pos/:posVendorId/menu` | – | `{ store: {...}, groups: [{ groupName, products: [{ sku, title, desc, price: "18.00", soldOut: false }] }] }` ← price as **string decimal** on purpose |
| POST | `/pos/:posVendorId/checks` | `{ externalRef, tableName, items: [{ sku, quantity, remark }] }` | `{ checkNumber: 1042, checkId: "chk_…", total: "54.00", status: "OPEN" }` |
| GET | `/pos/:posVendorId/checks/:checkId` | – | check with status `OPEN \| PAID \| IN_KITCHEN \| DONE \| VOID` |
| POST | `/pos/:posVendorId/checks/:checkId/tenders` | `{ amount: "54.00", tenderType: "QLUB", reference }` | check → `PAID` when tenders ≥ total |
| POST | `/pos/:posVendorId/checks/:checkId/close` | – | check → `DONE` |
| POST | `/pos/:posVendorId/items/:sku/sold-out` | `{ soldOut }` | for chaos / availability demo |

Rules
- `POST /checks` validates SKUs; unknown or sold-out SKU → `422 { code: "SKU_UNAVAILABLE", sku }`.
- Totals computed by mock-pos from its own prices; the adapter must compare with api's quote and fail the vendor order on mismatch (log both).
- Idempotency: same `externalRef` twice → return the existing check (no duplicate).

## 4. Chaos controls (for rehearsing failure)

Global via env (`MOCK_POS_LATENCY_MS`, `MOCK_POS_FAILURE_RATE`) and per-restaurant at runtime:

`POST /admin/chaos` `{ posVendorId, latencyMs?, failNextRequests?: number, down?: boolean }`

- `down: true` → all endpoints for that restaurant return 503 (demo "one vendor is offline" → partial failure + refund path).
- Exposed as toggles on the mock-pos UI (§5) so the demo driver can flip them on stage.

## 5. "Restaurant POS screen" UI (`GET /ui`)

A deliberately retro, single HTML page (server-rendered by Hono + htmx or vanilla JS, no build step) that looks like a generic POS terminal — so it is visually distinct from the qlub apps.

Layout:
- Tabs per restaurant (emoji + name).
- **Open checks** list: check number, table, items, total, status badge (`OPEN` / `PAID` / `DONE`), tender reference "QLUB mockpay_…".
- New check arrival: row flashes + "ding".
- Chaos panel (collapsible, top-right): latency slider, "Fail next request", "Take offline" toggle, per restaurant.
- Auto-refresh: SSE from mock-pos itself (`GET /ui/stream`) or 2s polling.

Styling: monospace (Courier New / IBM Plex Mono via system), dark green on near-black (`#9BE29B` on `#0E140E`) or high-contrast grey — it should feel like "the restaurant's own system", not ours. Min font 18px.

## 6. Optional webhooks (stretch)

If `WEBHOOK_URL` is set, mock-pos POSTs `{ posVendorId, checkId, status }` to `apps/api` `/v1/webhooks/mock-pos` when a check status changes from its own UI (e.g. "Mark DONE" button on the POS screen). Lets us show "kitchen marks done on POS → guest app updates", mirroring real webhook-based adapters.

## 7. Implementation notes

- In-memory store (Map) + JSON seed; reset on restart (`pnpm --filter mock-pos reset`).
- Check numbers increment per restaurant from 1001.
- Log every request one line: `[pos_sushi] POST /checks 201 54.00 (312ms)`.
- No dependency on `packages/contracts` for its own API shapes (it's "a third party"); it may import `packages/config` only.

## 8. Acceptance criteria

- [ ] `GET /pos/:id/menu` for all 3 restaurants returns valid menus; api sync maps them to `menu_item`
- [ ] Guest checkout creates exactly one check per restaurant involved, with tender `QLUB` and status `PAID`
- [ ] POS screen shows the check within 2s of payment
- [ ] "Take offline" on one restaurant → guest sees that vendor's part failed + refunded; others succeed
- [ ] Duplicate `externalRef` never creates a duplicate check
