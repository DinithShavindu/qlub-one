# One Venue, One Setup

Hackathon MVP: onboard a multi-vendor food court as **one** venue, let guests order from
every stall with **one scan and one payment**, and route each vendor its own order.

Specs live in [`context/`](context/README.md): start with [context/CLAUDE.md](context/CLAUDE.md),
then [ARCHITECTURE](context/docs/ARCHITECTURE.md), [DESIGN_SYSTEM](context/docs/DESIGN_SYSTEM.md),
[BUILD_PLAN](context/docs/BUILD_PLAN.md) and each app's `DESIGN.md`.

| App | What | Port |
|---|---|---|
| `apps/customer` | Guest mobile web app (Next.js) | 3000 |
| `apps/vendor` | Vendor kitchen display (Next.js) | 3001 |
| `apps/admin` | qlub ops admin + onboarding wizard (Next.js) | 3002 |
| `apps/api` | Orchestration API (Hono) — only owner of the DB | 4000 |
| `apps/mock-pos` | Mock restaurant POS + retro POS screen (Hono) | 4100 |

| Package | What |
|---|---|
| `packages/contracts` | zod schemas + TS types for every payload, money helpers |
| `packages/db` | MongoDB client, typed collections, ids, `db:reset` seed |
| `packages/ui` | Tailwind preset (design tokens) + shared React components, SSE hook, API client |
| `packages/config` | shared tsconfig |

## Quickstart

```bash
cp .env.example .env          # then paste MONGODB_URI from atlas-credentials.env
corepack enable pnpm          # or: npm i -g pnpm@9
pnpm install
pnpm db:reset                 # seeds 3 demo venues; prints vendor PINs + guest QR links per venue
pnpm dev                      # all five apps
```

- Admin: http://localhost:3002 (password `ADMIN_PASSWORD`, default `demo`)
- Guest: open a QR link printed by `db:reset`, e.g. http://localhost:3000/t/<token>
- Vendor: http://localhost:3001/login?venue=HARBOUR (or MARINA / DOWNTOWN; PINs from `db:reset`)
- Mock POS screen + chaos panel: http://localhost:4100/ui

`pnpm demo:reset` re-seeds the DB **and** clears the running mock-pos (checks, chaos toggles).

For phones/tablets on the same Wi-Fi, set `PUBLIC_CUSTOMER_URL=http://<laptop-ip>:3000` in `.env`
before `db:reset` / generating QR codes. The frontends proxy `/v1/*` to the API, so devices only
need to reach ports 3000–3002.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test        # split + rounding unit tests; API integration tests use a throwaway `<MONGODB_DB>_test` database
```

## Deviation from the spec: MongoDB instead of SQLite

The docs specify SQLite via Drizzle. This build uses **MongoDB Atlas** (`packages/db`, native
driver) because that's the provisioned database. Collections mirror ARCHITECTURE.md §2 one-to-one
(`venues`, `vendors`, `tables`, `menu_items`, `master_orders`, `vendor_orders`,
`settlement_entries`, `onboarding_runs`, plus `counters` for pickup codes). Vendor-order lines are
embedded in `vendor_orders.items` rather than a separate `vendor_order_item` table. Every document
keeps its prefixed ULID in `id` (unique index); Mongo's `_id` never leaves the API.

## Safety

Test payments only (`test_card`). No card fields, no real guest data — guests are an anonymous
cookie plus an optional first name. All vendors and menus are fictional.
`.env` and `atlas-credentials.env` are git-ignored; never commit them.
