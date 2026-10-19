# One Venue, One Setup

Hackathon MVP: onboard a multi-vendor food court as **one** venue, let guests order from
every stall with **one scan and one payment**, and route each vendor its own order.

| App | What | Port | Spec |
|---|---|---|---|
| `apps/customer` | Guest mobile web app | 3000 | [DESIGN.md](apps/customer/DESIGN.md) |
| `apps/vendor` | Vendor kitchen display | 3001 | [DESIGN.md](apps/vendor/DESIGN.md) |
| `apps/admin` | qlub ops admin + onboarding wizard | 3002 | [DESIGN.md](apps/admin/DESIGN.md) |
| `apps/api` | Orchestration API | 4000 | [ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| `apps/mock-pos` | Mock restaurant POS | 4100 | [DESIGN.md](apps/mock-pos/DESIGN.md) |

## Quickstart

```bash
cp .env.example .env
pnpm install
pnpm db:reset      # seeds venue, vendors, tables; prints vendor PINs
pnpm dev           # all apps
```

- Admin: http://localhost:3002 (password from `.env`)
- Guest: open the QR link printed by `db:reset`, e.g. http://localhost:3000/t/<token>
- Vendor: http://localhost:3001/login?venue=HARBOUR (PINs from `db:reset`)
- Mock POS screen: http://localhost:4100/ui

## Docs

- [CLAUDE.md](CLAUDE.md) — project context and rules for AI agents and humans (read first)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — data model, API, events, split logic
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — tokens, type, components
- [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) — 2-day plan, owners, demo script

## Safety

Test payments only. No real card data, no real guest data, all vendors and menus are fictional.
