# Build Plan — 2 days, team of 4

## 1. Owners

| Owner | Role | Owns | Also |
|---|---|---|---|
| **A** | Customer dev | `apps/customer` | demo phone setup |
| **B** | Backend lead | `apps/api`, `packages/contracts`, `packages/db` | split + rounding tests, adapter |
| **C** | Vendor + POS dev | `apps/vendor`, `apps/mock-pos` | sound, chaos controls |
| **D** | Admin + demo lead | `apps/admin`, `packages/ui` | seed data, QR print, demo script, slides |

Rule: B merges contract changes first; others build against `packages/contracts` + MSW mocks until the real endpoint lands.

## 2. Day 1 — make it work end to end (ugly is fine)

| Time | A (customer) | B (api) | C (vendor + mock-pos) | D (admin + ui) |
|---|---|---|---|---|
| 09:00–10:00 | **All together:** repo scaffold (turbo, pnpm, tsconfig, tailwind preset), agree contracts v0, seed list | | | |
| 10:00–12:30 | Menu screen on mocked data | DB schema, seed, `/t/:qr`, `/menu` (merged) | mock-pos menus + `/checks` + `/tenders` | `packages/ui` tokens + core components; admin login + venue list |
| 13:30–15:30 | Cart grouped by vendor, quote call | `/checkout/quote`, `/checkout`, mock gateway, fan-out via `MockPosAdapter` | KDS board (3 columns) with REST polling | Wizard steps 1–2 (venue, bulk vendors, PINs) |
| 15:30–17:30 | Checkout (test tile) + tracker (polling) | SSE streams, vendor login + status endpoint, settlement ledger | Vendor login PIN pad; status buttons wired | Wizard steps 3–5 (sync, tables+QR, go-live + timer) |
| 17:30–18:00 | **Checkpoint 1:** full happy path on laptops: onboard → scan → order 3 vendors → KDS → ready → tracker | | | |

Day-1 definition of done: happy path works once without manual DB edits.

## 3. Day 2 — make it demo-proof

| Time | A | B | C | D |
|---|---|---|---|---|
| 09:00–11:00 | SSE live updates, Ready alert (vibrate/chime), a11y live region | Partial-failure path + refund + reversal ledger; vendor isolation test; rounding tests | mock-pos POS screen UI + chaos toggles; KDS sound + new-order animation | Dashboard tiles + settlements page + Σ check |
| 11:00–12:30 | Loading/empty/error states everywhere | Hardening: timeouts, idempotency, logs redaction | KDS offline/reconnect; phone portrait layout | QR print sheet; baseline comparison on go-live |
| 13:30–15:00 | **Bug bash together** on real devices: 1 phone, 2 tablets, 1 laptop on the demo Wi-Fi | | | |
| 15:00–16:30 | Polish copy + transitions | Reset script `pnpm demo:reset` | Rehearse chaos path | Slides (problem → live demo → numbers → roadmap) |
| 16:30–17:30 | **Two full rehearsals** of the demo script, timed | | | |

## 4. Demo script (5 minutes)

1. **Problem (30s)** — slide: "Today a 25-vendor food court = 25 setups, 25 QR sets, 25 payout reconciliations." Show baseline hours.
2. **One setup (90s)** — D on admin: create "Harbour Food Hall", pick 3 POS vendors + paste 1 tablet vendor, sync menus, generate 12 QRs, Go live. Timer shows ~3–4 min (pre-filled form fields allowed).
3. **One scan, one payment (60s)** — A on phone (screen mirrored): scan printed QR, add shawarma + sushi + juice, cart grouped by vendor, pay with test card.
4. **Each vendor gets only its order (45s)** — C shows two tablets side by side (Shawarma, Sushi) + mock-pos POS screen: checks appear with tender "QLUB". Mark shawarma Ready → phone buzzes "S-07 ready".
5. **When things break (30s)** — take Fresh Press Juice offline in chaos panel, order again: juice part fails + refunded, other vendors fine.
6. **Numbers & next (45s)** — admin dashboard + settlement ledger (Σ check ✓). Roadmap slide: real POS adapters, real split payouts, hotels/charge-to-room.

Backup: screen recording of a full successful run (record on Day 2 morning).

## 5. Cut list (drop in this order if behind)

1. Search on customer menu
2. Item availability toggles on vendor panel
3. mock-pos webhooks
4. Live orders feed on admin dashboard
5. Vendor history page
6. QR SVG download (keep print)
7. SSE → fall back to 3s polling everywhere (keep the demo, lose elegance)

Never cut: wizard + timer, merged menu, grouped cart, one payment → per-vendor orders, KDS Ready → guest alert, failure + refund path.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Venue Wi-Fi blocks devices talking to laptop | Bring a travel router; all devices on it; fixed laptop IP in `.env` |
| iOS blocks sound/vibration | "Turn on alerts" tap; visual Ready state is the real signal |
| Contract churn between 4 devs | Freeze contracts v1 at Day 1 13:00; changes after need B's approval |
| Time sink on styling | `packages/ui` components first; apps don't style from scratch |
| Live demo failure | `pnpm demo:reset` + recorded backup video |
