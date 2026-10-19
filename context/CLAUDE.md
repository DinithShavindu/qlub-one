# One Venue, One Setup — Monorepo Context

> Read this file first. Then read the `DESIGN.md` of the app you are working in.
> This file is the source of truth for scope, architecture, conventions and rules.
> It is written for AI coding agents (Claude Code, Cursor, Copilot) and the humans pairing with them.

## 1. What we are building

A **2-day hackathon MVP** (team of 4) that proves qlub can onboard and run a
**multi-vendor food court as ONE venue** instead of N separate restaurants.

**The internal inefficiency we remove (Operational Excellence theme):**
today a 25-vendor food court is onboarded as 25 restaurants: 25 setups, 25 QR
mappings, 25 payout reconciliations, all by hand. This MVP makes "venue with many
outlets" a first-class object: one setup, one QR per seat, one payment, split
automatically into one order per vendor.

**Demo in one sentence:** an admin onboards a 3-vendor food court in under
5 minutes; a guest scans one QR, orders from 3 vendors in one basket, pays once
(test payment); each vendor sees only its own order on its kitchen screen and on
its (mock) POS; the guest gets a "ready" ping per vendor.

## 2. Scope

### In scope (must ship)
1. **Admin panel** — onboarding wizard: venue → vendors (bulk) → menu sync → tables + QR → go live. Shows setup time.
2. **Customer app** — scan QR → merged menu → one cart grouped by vendor → test checkout → live order tracker.
3. **Vendor panel** — PIN login → kitchen display (New / Preparing / Ready) → status updates push to guest.
4. **Mock restaurant (mock POS)** — fake POS for 3–4 fictional vendors: serves menus, receives orders, shows a "POS screen".
5. **API** — merges menus, quotes basket, takes one payment, fans out one order per vendor, keeps a mock settlement ledger.

### Out of scope (do NOT build — roadmap slides only)
- Real payment gateway, real payouts / split settlement to bank accounts
- Hotel features: PMS, charge-to-room, room QR
- Real POS integrations (Simphony, Foodics, etc.) — the adapter interface is ready for them, nothing more
- Auth beyond PIN / single admin password, multi-language, refunds UI, loyalty, tips
- Production infra, CI/CD beyond lint + typecheck

If a task drifts into "out of scope", stop and leave a `// ROADMAP:` comment instead.

## 3. Monorepo layout

```
one-venue-one-setup/
├── CLAUDE.md                  ← you are here
├── README.md                  ← human quickstart
├── docs/
│   ├── ARCHITECTURE.md        ← data model, API contracts, events, split logic
│   ├── DESIGN_SYSTEM.md       ← tokens, typography, components, a11y
│   └── BUILD_PLAN.md          ← 2-day schedule, owners, demo script, cut list
├── apps/
│   ├── customer/   (DESIGN.md)   Next.js — guest mobile web app        :3000
│   ├── vendor/     (DESIGN.md)   Next.js — vendor kitchen display      :3001
│   ├── admin/      (DESIGN.md)   Next.js — qlub ops admin panel        :3002
│   ├── api/                      Hono — core orchestration API         :4000
│   └── mock-pos/   (DESIGN.md)   Hono + tiny UI — mock restaurant POS  :4100
├── packages/
│   ├── contracts/   zod schemas + inferred TS types (SOURCE OF TRUTH for every payload)
│   ├── ui/          shared React components + Tailwind preset (design tokens)
│   ├── db/          Drizzle schema + SQLite client + seed
│   └── config/      eslint, tsconfig, tailwind base
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## 4. Stack (fixed — do not swap without team agreement)

| Concern | Choice | Why |
|---|---|---|
| Package manager / tasks | pnpm workspaces + Turborepo | fast parallel dev |
| Language | TypeScript 5, `strict: true` everywhere | shared types across apps |
| Frontends | Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui | fastest UI velocity |
| API + mock POS | Hono on Node 20 | tiny, typed, fast |
| Validation | zod (in `packages/contracts`) | one schema → runtime check + TS type |
| DB | SQLite via Drizzle ORM (`packages/db`), file `./data/dev.db` | zero setup |
| Realtime | Server-Sent Events (SSE) from `apps/api` | simpler than websockets, enough for demo |
| QR codes | `qrcode` npm package (SVG) | |
| Payments | **Mock gateway** inside `apps/api` (`test_card` only) | no real card data, ever |
| Data fetching (FE) | TanStack Query | caching + SSE invalidation |

## 5. Commands

```bash
pnpm install
pnpm db:reset          # drop + migrate + seed (venue, 3 vendors, menus in mock-pos)
pnpm dev               # runs all apps via turbo (ports above)
pnpm dev --filter=customer   # one app
pnpm lint && pnpm typecheck  # must pass before every merge
pnpm test              # vitest — split logic + rounding tests are mandatory
```

Env (`.env` at root, copy from `.env.example`):
```
API_URL=http://localhost:4000
MOCK_POS_URL=http://localhost:4100
ADMIN_PASSWORD=demo
PUBLIC_CUSTOMER_URL=http://localhost:3000   # used to build QR links
MOCK_POS_LATENCY_MS=300
MOCK_POS_FAILURE_RATE=0
```

## 6. Golden rules for AI agents

1. **Contracts first.** Every request/response/event shape lives in `packages/contracts`. Import from there; never redeclare a type in an app. Changing a contract = tell the team in chat, because 4 people depend on it.
2. **Money is integer minor units** (`priceMinor`, fils for AED). Never floats. Format only at the edge with `formatMoney(minor, currency)` from `packages/ui`.
3. **Split invariant:** `sum(vendorOrder.subtotalMinor) === masterOrder.subtotalMinor`. Covered by a test; never break it.
4. **No real payment or personal data.** Only `paymentMethod: "test_card"`. Do not add fields for card numbers, phone, email or full names. Guest = anonymous `guestToken` + optional first name for pickup.
5. **Vendor isolation:** a vendor endpoint must only ever return that vendor's orders. Every vendor query filters by `vendorId` from the session, never from the request body.
6. **POS access goes through the adapter.** `apps/api` talks to POSs only via `PosAdapter` (see ARCHITECTURE.md §5). No `fetch(MOCK_POS_URL…)` outside `adapters/mock-pos.ts`.
7. **Follow the app's DESIGN.md** for screens, states and copy. Use tokens from `packages/ui`; no hard-coded hex values in apps.
8. **Every screen has loading, empty and error states.** The demo will be on bad Wi-Fi.
9. **Small PRs, one owner per app** (see BUILD_PLAN.md). Don't edit another owner's app without pinging them.
10. **Don't gold-plate.** If it isn't in the demo script, it's optional.

## 7. Code conventions

- Files: `kebab-case.ts`; React components `PascalCase.tsx`; one component per file.
- IDs: prefixed ULIDs — `ven_`, `vdr_`, `tbl_`, `itm_`, `mo_` (master order), `vo_` (vendor order), `stl_`.
- API routes: `/v1/...`, JSON, errors as `{ error: { code, message } }` with codes from `contracts/errors.ts`.
- Timestamps: ISO-8601 UTC strings in payloads; display in venue timezone (`Asia/Dubai` in seed).
- Logging: `pino` in api/mock-pos; never log full request bodies on `/checkout`.
- Tests: `vitest`; colocate as `*.test.ts`.
- Commits: conventional (`feat(customer): cart grouped by vendor`).

## 8. Glossary

| Term | Meaning |
|---|---|
| Venue | The food court. One setup, one dashboard, one QR set. |
| Vendor | A stall/outlet inside the venue. Has its own POS (mock) or uses the tablet KDS. |
| Table | A seat/table in the shared seating area, identified by a QR token. |
| Master order (`mo_`) | What the guest pays for: one basket, one payment. |
| Vendor order (`vo_`) | The slice of a master order for one vendor; what that vendor's kitchen sees. |
| KDS | Kitchen display system — the vendor panel. |
| Fan-out | Splitting a paid master order into vendor orders and submitting each to its POS. |
| Settlement ledger | Mock record of what each vendor is owed (gross − fee = net). No money moves. |

## 9. Where to look

- Data model, endpoints, SSE events, split + rounding rules → `docs/ARCHITECTURE.md`
- Colors, type, spacing, components, status colors → `docs/DESIGN_SYSTEM.md`
- Who owns what, hour-by-hour plan, demo script → `docs/BUILD_PLAN.md`
- Screen-level specs → `apps/<app>/DESIGN.md`
