# Vendor Panel (Kitchen Display) — Design Spec

> Stall-side app. Next.js 14 App Router, port **3001**.
> Read `/CLAUDE.md` and `/docs/DESIGN_SYSTEM.md` first. Contracts: `packages/contracts`.

## 1. Job to be done

"I run one stall in a busy food court. Show me only MY orders, loudly when they arrive,
and let me mark them ready with one tap so the guest comes to collect."

Used by: stall staff, often wearing gloves, in noise, glancing from 1–2 m away.
Used for: vendors in `posMode: "tablet"` (no POS) AND as a companion screen for `mock_pos` vendors.

## 2. Target device & constraints

- Tablet landscape, 1024×768 to 1366×1024. Also must be usable on a phone in portrait (stacked columns).
- Always-on screen. Huge type, 64px+ tap targets, high contrast, readable at 2 m.
- Dark theme by default (kitchens are bright; dark reduces glare) — toggle in settings.
- Session lasts 12h; survives refresh.

## 3. Routes

| Route | Screen |
|---|---|
| `/login` | Vendor picker + PIN |
| `/` | Kitchen board (KDS) |
| `/history` | Today's collected/failed orders |
| `/settings` | Sound, theme, (stretch) item availability |

## 4. Screens

### 4.1 Login
- Step 1: venue code input (seed: `HARBOUR`) or deep link `/login?venue=…` → shows vendor tiles (emoji + name).
- Step 2: tap your stall → 4-digit PIN pad (big keys, 72px). Wrong PIN → shake + "Wrong PIN". 5 wrong tries → 30s cooldown.
- On success, `POST /v1/vendor/login` sets cookie → `/`.

### 4.2 Kitchen board (`/`) — hero screen
Top bar (64px): `VendorBadge` (large), venue name, live clock, `ConnectionDot`, today's count ("23 orders"), sound on/off, menu.

Board = **3 columns**: `New` | `Preparing` | `Ready`. Column header shows count. Oldest first (FIFO).

**Order card**:
- `PickupCode` (display 56px), guest first name if given, table label, age timer ("4:12", turns `brand-strong` after 8 min, `status-failed` text after 15 min).
- Item list: qty in bold + name; notes in italic on their own line, highlighted.
- One primary action, full card width, `Button size=xl`:
  - New → **"Start preparing"**
  - Preparing → **"Mark ready"**
  - Ready → **"Collected"** (secondary style) — removes card to history
- Secondary "⋯": "Move back" (undo last step within 30s), "Print ticket" (stretch).
- Tapping the card body opens a detail drawer (same info, bigger).

Behaviour:
- New order arrives (SSE `vendor_order.created`): card slides into `New`, 2 beeps, pulsing border 10s, tab title flashes "(1) New order".
- Status change → optimistic move, `POST /vendor/orders/:id/status`; on failure revert + toast "Couldn't update — retrying".
- Undo toast after every action (5s).
- Empty column: subtle EmptyState ("No new orders").
- Offline: banner "Offline — orders will appear when connection returns"; on reconnect refetch `GET /vendor/orders`.

### 4.3 History
- Table: code, items count, total (vendor subtotal), status, placed at, completed at, prep time.
- Today's totals: orders, gross (subtotal), qlub fee, net — read from settlement ledger (mock).

### 4.4 Settings
- Sound on/off + test sound button; theme; (stretch) per-item "Sold out" toggles → `POST /vendor/items/:id/availability`.
- "Log out".

## 5. Isolation & security (must hold)

- The app never receives other vendors' data: all endpoints scoped by session `vendorId` (server-side).
- No guest personal data except optional first name and table label.
- No prices from other vendors, no venue-wide totals.

## 6. Component map

`PinPad`, `VendorTilePicker`, `KdsTopBar`, `KdsColumn`, `KdsOrderCard`, `AgeTimer`, `OrderDetailDrawer`, `UndoToast`, `OfflineBanner`, `HistoryTable`.

## 7. Sound

- Use Web Audio; unlock on first tap after login ("Tap to enable sound" overlay if blocked).
- New order: two short beeps (880Hz, 120ms). Repeat every 30s while any order sits in New > 2 min (stretch).

## 8. Acceptance criteria (demo-critical)

- [ ] Login with seed PIN in < 10s
- [ ] Guest pays → order appears in `New` within 2s with sound
- [ ] Two taps move it New → Preparing → Ready; guest sees Ready within 2s
- [ ] Vendor A never sees vendor B's orders (tested with 2 tablets side by side in the demo)
- [ ] Readable from 2 m on a 10" tablet; usable in portrait on a phone
- [ ] Offline/reconnect recovers without losing orders
