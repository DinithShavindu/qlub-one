# Customer App — Design Spec

> Guest-facing mobile web app. Next.js 14 App Router, port **3000**.
> Read `/CLAUDE.md` and `/docs/DESIGN_SYSTEM.md` first. Contracts: `packages/contracts`.

## 1. Job to be done

"I'm sitting in a food court. I want food from several stalls without queuing at each one,
pay once, and know when each part is ready."

## 2. Target device & constraints

- Mobile web, 360–430px wide, portrait. Max content width 480px (centered on desktop).
- No install, no login, no account. Opened from a QR scan.
- Must work on slow 4G: skeletons, optimistic UI, < 200KB JS on first load where possible.
- Guest identity: `guestToken` cookie (set by API on `/t/:qrToken`). Optional first name at checkout.

## 3. Routes

| Route | Screen |
|---|---|
| `/t/[qrToken]` | Landing / resolve table → redirect to `/v/[venueId]/menu?table=…` |
| `/v/[venueId]/menu` | Merged menu (all vendors) |
| `/v/[venueId]/menu/[vendorSlug]` | Same screen, scrolled + filtered to one vendor (deep link) |
| `/v/[venueId]/cart` | Cart grouped by vendor |
| `/v/[venueId]/checkout` | Test payment |
| `/o/[masterOrderId]` | Live order tracker |

State: cart in `zustand` persisted to `sessionStorage` (key `cart:<venueId>`), cleared after successful checkout.

## 4. Screens

### 4.1 Landing (`/t/[qrToken]`)
- Calls `GET /v1/t/:qrToken`. Shows for ≤ 800ms: venue name, "Table T12", vendor emoji row, then redirects.
- Errors: unknown QR → "This QR isn't active. Ask staff for help." Venue `draft` → "Opening soon".

### 4.2 Merged menu
Layout (top → bottom):
1. **Header** (sticky): venue name, `Table T12` pill, cart icon with count badge.
2. **Vendor rail** (sticky, horizontal scroll): one chip per vendor — emoji, name, accent dot, "Closed" label if closed. Tapping scrolls to that vendor's section; chip highlights as you scroll (IntersectionObserver).
3. **Search** (optional stretch): filters across all vendors.
4. **Vendor sections**, in vendor `sortOrder`:
   - Section header: `VendorBadge` large + "~10 min" (static in MVP) + "Closed" state.
   - Categories as sub-headers; item rows: name, 2-line description, `MoneyText`, image thumb (if any), `+` button.
   - Unavailable items: greyed, "Sold out", no `+`.
5. **Sticky cart bar** (appears when cart > 0): "3 items from 2 vendors · AED 64.00 · View cart →".

Interactions:
- `+` adds qty 1 instantly (toast "Added to Shawarma Station"); tapping the row opens the **Item sheet**: image, description, qty stepper, note field (max 80 chars), "Add · AED 24.00".
- Adding from a closed vendor is impossible (button hidden).

States: skeleton (3 vendor sections × 3 rows), empty menu ("No items yet"), error with retry.

### 4.3 Cart (`/cart`)
- Lines **grouped by vendor**: group header = `VendorBadge` + vendor subtotal. Each line: name, note, `QtyStepper`, line total, remove.
- Summary card: per-vendor subtotals listed, then **Total**. Copy under total: "One payment. We'll send each stall its part of your order."
- On load, call `POST /checkout/quote` to re-price server-side; if prices/availability changed, show inline banner and update lines.
- CTA: "Checkout · AED 64.00" (disabled while quoting).
- Empty cart → EmptyState "Your cart is empty" + "Browse menu".

### 4.4 Checkout (`/checkout`)
- Read-only order summary (collapsed groups).
- Optional field: "Name for pickup (optional)" — max 20 chars, helper text "Only used so stalls can call you."
- **Payment block = TEST MODE**: a clearly labelled card-like tile "Test card •••• 4242 — demo only, no real charge". No card inputs exist.
- Hidden demo toggles (long-press on "TEST MODE" label): "Simulate decline", "Simulate one vendor failing" (sets `simulate` / mock-pos chaos via API query param).
- CTA "Pay AED 64.00". On tap: button loading, disable back navigation.
- Results:
  - Success → replace route to `/o/[masterOrderId]`.
  - `PAYMENT_DECLINED` → inline error "Payment didn't go through. Nothing was charged." + retry.
  - `ITEM_UNAVAILABLE` / `VENDOR_CLOSED` → back to cart with banner naming the item/vendor.

### 4.5 Order tracker (`/o/[masterOrderId]`) — the hero screen
Layout:
1. Header: "Order placed · paid AED 64.00", time, `ConnectionDot`.
2. **One card per vendor order**:
   - `VendorBadge`, items summary ("2× Chicken shawarma, 1× Fries")
   - `StatusChip` (New → Preparing → Ready → Collected)
   - 4-step progress bar
   - **When Ready**: card turns `status-ready`, big `PickupCode` "S-07", copy "Pick up at Shawarma Station", vibration + chime (once per card).
   - **When Failed**: `status-failed` card, "Sushi Corner couldn't take this part. AED 42.00 refunded." 
3. Footer: "Order more" (back to menu, cart empty), help text "Show this screen at the counter."

Realtime: subscribe to `GET /orders/:id/stream` (SSE). On reconnect → refetch `GET /orders/:id`. If SSE unsupported/blocked, poll every 5s.
Accessibility: status changes announced in an `aria-live="polite"` region ("Shawarma Station: ready, code S 0 7").
Sound: muted by default on iOS until first user tap — show a small "🔔 Turn on ready alerts" button that unlocks audio.

## 5. Component map

`VendorRail`, `VendorSection`, `MenuItemRow`, `ItemSheet`, `CartBar`, `CartVendorGroup`, `CartSummary`, `TestPaymentTile`, `VendorOrderCard`, `OrderProgress`, `ReadyAlert` — plus shared from `packages/ui`.

## 6. Data & caching

- TanStack Query keys: `['table', qrToken]`, `['menu', venueId]` (staleTime 60s), `['order', masterOrderId]`.
- SSE handler updates `['order', id]` cache via `setQueryData`.
- Never compute totals for display from client prices once a quote exists — show the quote's numbers.

## 7. Copy deck

| Key | Text |
|---|---|
| cart.bar | "{n} items from {v} vendors · {total}" |
| cart.explainer | "One payment. We'll send each stall its part of your order." |
| checkout.testmode | "Test mode — demo only, no real charge" |
| tracker.ready | "Ready! Pick up at {vendor} — code {code}" |
| tracker.failed | "{vendor} couldn't take this part. {amount} refunded." |
| error.generic | "Something went wrong. Check your connection and try again." |

## 8. Acceptance criteria (demo-critical)

- [ ] Scan QR → menu shows 3+ vendors in < 2s on local network
- [ ] Cart groups lines by vendor with correct per-vendor subtotals
- [ ] Pay once → tracker shows one card per vendor
- [ ] Vendor marks "Ready" on KDS → guest card flips to Ready in < 2s with code
- [ ] Simulated vendor failure shows refund copy on that card only
- [ ] All screens have loading / empty / error states
- [ ] No real card input fields anywhere
