# Architecture — One Venue, One Setup

Source of truth for data model, API contracts, realtime events and the split logic.
Every shape below must exist as a zod schema in `packages/contracts`.

## 1. System diagram

```
            ┌───────────────┐   scan QR    ┌────────────────────┐
  Guest ───►│ customer :3000│─────────────►│                    │
            └───────────────┘   REST + SSE │                    │  PosAdapter   ┌──────────────────┐
            ┌───────────────┐              │     api :4000      │──────────────►│  mock-pos :4100  │
  Vendor ──►│ vendor   :3001│◄────────────►│  (Hono + SQLite)   │◄──────────────│  "restaurant POS"│
            └───────────────┘   REST + SSE │                    │   webhooks    │  3–4 fake vendors│
            ┌───────────────┐              │ mock payment gw    │               └──────────────────┘
  qlub ops─►│ admin    :3002│─────────────►│ settlement ledger  │
            └───────────────┘   REST       └────────────────────┘
```

- `api` is the only service that owns the database.
- Frontends never call `mock-pos` directly (except mock-pos's own UI).
- Vendors in `posMode: "tablet"` have no POS; their orders live only in `api` and show on the vendor panel.

## 2. Data model (Drizzle / SQLite)

```ts
venue          { id: "ven_", name, slug, type: "food_court", currency: "AED", timezone,
                 feeBps: number /* e.g. 100 = 1% */, status: "draft" | "live", createdAt }

vendor         { id: "vdr_", venueId, name, slug, emoji, accentToken /* ui token name */,
                 posMode: "mock_pos" | "tablet", posVendorId: string | null,
                 pin: string /* 4 digits, hashed */, isOpen: boolean, sortOrder }

table          { id: "tbl_", venueId, label /* "T12" */, qrToken /* random 16 chars */ }

menu_item      { id: "itm_", vendorId, posItemId, name, description, category,
                 priceMinor, imageUrl: string | null, available: boolean, syncedAt }

master_order   { id: "mo_", venueId, tableId, guestToken, guestFirstName: string | null,
                 status: "pending_payment" | "paid" | "partially_failed" | "completed" | "payment_failed",
                 subtotalMinor, totalMinor, currency, paymentRef: string | null, createdAt }

vendor_order   { id: "vo_", masterOrderId, vendorId, posOrderId: string | null,
                 status: "submitting" | "new" | "preparing" | "ready" | "collected" | "failed",
                 pickupCode /* "A-42" */, subtotalMinor, feeMinor, netMinor,
                 failureReason: string | null, createdAt, updatedAt }

vendor_order_item { id, vendorOrderId, menuItemId, posItemId, name, qty, unitPriceMinor, lineTotalMinor, note }

settlement_entry  { id: "stl_", venueId, vendorId, vendorOrderId, grossMinor, feeMinor, netMinor,
                    type: "sale" | "reversal", createdAt }

onboarding_run    { id, venueId, startedAt, finishedAt, stepsJson }   // powers the "setup time" KPI
```

Notes
- `guestFirstName` is optional, max 20 chars, shown only as the pickup name. No other guest PII.
- `pin` is stored hashed (bcrypt). Seed PINs are printed by `pnpm db:reset`.

## 3. REST API (`apps/api`, base `/v1`)

Errors: `{ "error": { "code": "VENDOR_CLOSED", "message": "..." } }`.

### 3.1 Customer (no auth; `guestToken` cookie set on first scan)

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET | `/t/:qrToken` | – | `{ venue, table, vendors[] }` |
| GET | `/venues/:venueId/menu` | – | `{ vendors: [{ vendor, categories: [{ name, items[] }] }] }` (merged menu) |
| POST | `/checkout/quote` | `{ venueId, tableId, lines: [{ menuItemId, qty, note? }] }` | `{ groups: [{ vendorId, lines[], subtotalMinor }], subtotalMinor, totalMinor }` |
| POST | `/checkout` | quote body + `{ paymentMethod: "test_card", guestFirstName? , simulate?: "decline" }` | `{ masterOrder, vendorOrders[] }` |
| GET | `/orders/:masterOrderId` | – | `{ masterOrder, vendorOrders[] }` (only if `guestToken` matches) |
| GET | `/orders/:masterOrderId/stream` | SSE | events §4 |

### 3.2 Vendor (auth: `POST /vendor/login { vendorId, pin }` → httpOnly session cookie)

| Method | Path | Returns |
|---|---|---|
| GET | `/vendor/me` | `{ vendor, venue }` |
| GET | `/vendor/orders?status=new,preparing,ready` | `{ vendorOrders[] }` — **filtered by session vendorId** |
| POST | `/vendor/orders/:vendorOrderId/status` `{ status }` | updated vendor order. Allowed: new→preparing→ready→collected |
| POST | `/vendor/items/:menuItemId/availability` `{ available }` | stretch goal |
| GET | `/vendor/stream` | SSE for this vendor only |

### 3.3 Admin (auth: `POST /admin/login { password }` → cookie)

| Method | Path | Purpose |
|---|---|---|
| POST | `/admin/venues` `{ name, currency, timezone, feeBps }` | wizard step 1; starts `onboarding_run` |
| POST | `/admin/venues/:id/vendors/bulk` `{ vendors: [{ name, emoji, posMode, posVendorId? }] }` | step 2; returns vendors + generated PINs (shown once) |
| GET | `/admin/pos/vendors` | lists vendors available in mock-pos (for the picker) |
| POST | `/admin/venues/:id/menus/sync` | step 3; calls `adapter.getMenu` for every vendor in parallel; returns per-vendor result |
| POST | `/admin/venues/:id/tables` `{ count, prefix }` | step 4; creates tables + qrTokens |
| GET | `/admin/venues/:id/qr.pdf` (stretch) / `/qr-sheet` | printable QR sheet (HTML) |
| POST | `/admin/venues/:id/go-live` | step 5; sets `live`, closes `onboarding_run` → returns `setupDurationMs` |
| GET | `/admin/venues/:id/dashboard` | `{ ordersToday, gmvMinor, byVendor[], avgPrepSeconds, setupDurationMs }` |
| GET | `/admin/venues/:id/settlements` | ledger rows + per-vendor totals |
| GET | `/admin/venues` | list |

## 4. Realtime events (SSE)

Event envelope: `{ type, at, data }`.

| Type | Sent to | Data |
|---|---|---|
| `vendor_order.created` | vendor stream | full vendor order |
| `vendor_order.updated` | vendor stream + guest order stream | `{ vendorOrderId, status, pickupCode }` |
| `vendor_order.failed` | guest + admin | `{ vendorOrderId, reason, refundedMinor }` |
| `master_order.updated` | guest | `{ status }` |
| `heartbeat` | all | every 15s (keeps proxies from closing) |

Frontends: on reconnect, refetch the REST resource (events are not replayed).

## 5. POS adapter interface (`apps/api/src/adapters`)

Names deliberately mirror qlub's sdk-go adapter methods so this can be ported to a Go adapter later.

```ts
export interface PosAdapter {
  getMenu(vendor: Vendor): Promise<PosMenu>;                          // ~ GetMenu
  calculateOrder?(vendor: Vendor, lines: PosLine[]): Promise<PosQuote>; // ~ CalculateOrder (optional)
  submitOrder(vendor: Vendor, order: PosOrderInput): Promise<{ posOrderId: string }>; // ~ SubmitOrder
  updatePaymentStatus(vendor: Vendor, posOrderId: string, paidMinor: number, ref: string): Promise<void>; // ~ UpdatePaymentStatus
  closeOrder?(vendor: Vendor, posOrderId: string): Promise<void>;     // ~ CloseOrder
}
```

Implementations:
- `MockPosAdapter` → HTTP to `mock-pos` (§ mock-pos DESIGN.md).
- `TabletAdapter` → no-op: menu is managed in api (seeded), orders live only in api.

Resolution: `adapterFor(vendor) = vendor.posMode === "mock_pos" ? mockPos : tablet`.

## 6. Checkout & fan-out algorithm

```
POST /checkout
 1. Validate lines (zod). Load menu items; reject if any unavailable or vendor closed  → 409 ITEM_UNAVAILABLE / VENDOR_CLOSED
 2. Price server-side from DB (never trust client prices). Group lines by vendorId.
 3. Create master_order (pending_payment).
 4. Mock gateway charge(totalMinor, "test_card", simulate)
      decline → master_order.payment_failed → 402 PAYMENT_DECLINED (nothing sent to vendors)
 5. master_order → paid, paymentRef = "mockpay_<ulid>"
 6. For each vendor group IN PARALLEL (Promise.allSettled, 5s timeout each):
      a. create vendor_order (submitting), pickupCode
      b. adapter.submitOrder → posOrderId
      c. adapter.updatePaymentStatus(posOrderId, subtotalMinor, paymentRef)
      d. vendor_order → new; settlement_entry(sale); emit vendor_order.created
      on failure: vendor_order → failed; mock refund of that group's subtotal;
                  settlement_entry(reversal); emit vendor_order.failed
 7. master_order → paid | partially_failed (if any group failed)
 8. Return { masterOrder, vendorOrders }
```

When all vendor orders reach `collected`, master order → `completed`.

## 7. Money & rounding rules

- All amounts integer minor units. Currency from venue.
- `lineTotalMinor = unitPriceMinor * qty`.
- `vendor.subtotalMinor = Σ lineTotalMinor` for that vendor.
- `master.subtotalMinor = Σ vendor.subtotalMinor` (**invariant, tested**).
- MVP has no guest-facing fees/tax/tips: `totalMinor = subtotalMinor`.
- qlub fee is **per vendor order**: `feeMinor = round_half_up(subtotalMinor * feeBps / 10_000)`, `netMinor = subtotalMinor - feeMinor`.
- Mandatory tests: 1-vendor, 3-vendor, odd amounts (e.g. 1,005 fils at 100 bps → fee 10), a failed vendor reversal netting to zero.

## 8. Pickup codes

`<vendor letter>-<2 digits>`, e.g. `S-07`. Letter = first letter of vendor slug (unique per venue; seed guarantees it). Counter resets daily per vendor.

## 9. Security & privacy (hackathon level, but honest)

- Test payments only; no PAN/CVV fields exist anywhere in code or DB.
- Guest data: `guestToken` (random, cookie) + optional first name. No phone, email, address, location.
- Vendor isolation enforced server-side from session (rule 5 in CLAUDE.md); add a test that vendor A cannot read vendor B's order.
- Admin behind a single password from env; vendor PINs hashed.
- Logs: no request bodies on `/checkout`; `pino` redact `guestFirstName`.
- All seed data (vendors, menus) is fictional.

## 10. Seed data (`pnpm db:reset`)

- Venue: **"Harbour Food Hall"** (fictional), AED, Asia/Dubai, feeBps 100, status `draft` (so the wizard can be demoed) — plus a pre-built `live` copy "Harbour Food Hall (demo)" for the guest flow.
- Vendors (in mock-pos): Shawarma Station (S), Sushi Corner (C), Fresh Press Juice (F) — `mock_pos`; Burger Lab (B) — `tablet`.
- 12 tables `T1`–`T12`. PINs printed to console.
