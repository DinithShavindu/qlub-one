# Admin Panel (qlub Ops) — Design Spec

> Internal tool for qlub ops / onboarding. Next.js 14 App Router, port **3002**.
> Read `/CLAUDE.md` and `/docs/DESIGN_SYSTEM.md` first. Contracts: `packages/contracts`.

## 1. Job to be done

"Onboard a whole food court — every vendor, every menu, every table QR — in ONE flow,
in minutes, instead of setting up each stall as a separate restaurant."

**This app is where the hackathon theme is proven.** The headline metric on screen is
**setup time** (from `onboarding_run`) vs the baseline of N separate setups.

## 2. Target device & constraints

- Desktop/laptop, 1280–1920px. Light theme. Content max-width 1200px.
- Single admin password (env `ADMIN_PASSWORD`), cookie session.
- Must look credible to leadership in a live demo; must never dead-end.

## 3. Routes

| Route | Screen |
|---|---|
| `/login` | Password |
| `/venues` | Venue list |
| `/venues/new` | **Onboarding wizard** (5 steps) |
| `/venues/[id]` | Venue dashboard |
| `/venues/[id]/vendors` | Vendors (list, PINs reset, open/closed) |
| `/venues/[id]/tables` | Tables + printable QR sheet |
| `/venues/[id]/settlements` | Mock settlement ledger |

Layout: left sidebar (Venues, + New venue), top bar with venue switcher and "Live / Draft" pill.

## 4. Onboarding wizard (`/venues/new`) — hero flow

`StepWizard` across the top: **1 Venue → 2 Vendors → 3 Menus → 4 Tables & QR → 5 Review & go live**.
A **setup timer** chip in the top-right starts at step 1 ("Setup time 01:42").

### Step 1 — Venue
Fields: name, venue type (fixed "Food court"), currency (AED), timezone (Asia/Dubai), qlub fee % (default 1.0 → `feeBps`).
CTA "Continue" → `POST /admin/venues`.

### Step 2 — Vendors (the "25 setups → 1" moment)
Two ways, side by side:
- **Pick from POS**: list from `GET /admin/pos/vendors` (mock-pos) with checkboxes — "Select all".
- **Bulk paste**: textarea, one vendor per line `Name, emoji, pos|tablet` — parsed live into a preview table with inline validation (duplicate names, missing emoji → default 🍽️).
Preview table: name, emoji, mode (`Mock POS` / `Tablet`), accent (auto-assigned `vendor-1..6`), editable.
CTA "Create 4 vendors" → `POST /vendors/bulk`. Result modal: **generated PINs shown once** with "Copy all" + warning "PINs won't be shown again".

### Step 3 — Menus
CTA "Sync all menus" → `POST /menus/sync`. Per-vendor rows update live:
`VendorBadge` · status (Syncing… / ✓ 14 items / ⚠ failed: "POS timeout") · "Retry" on failures.
Tablet vendors show "Menu from seed" (or stretch: simple item editor).
Summary line: "3 vendors synced · 47 items · 0 errors". Can continue with failures (warning).

### Step 4 — Tables & QR
Inputs: number of tables (default 12), prefix ("T"). CTA "Generate".
Grid of `QrCard`s (SVG QR + "Harbour Food Hall · T7" + URL). Actions: "Print sheet" (opens `/venues/[id]/tables?print=1`, print CSS, 12 per A4), "Download SVGs" (stretch).
Callout: "One QR per seat works for every vendor — no per-stall QR codes."

### Step 5 — Review & go live
Checklist: venue ✓, 4 vendors ✓, 47 items ✓, 12 QR codes ✓, warnings listed.
CTA "Go live" → `POST /go-live` → success screen:
- Big `StatTile`: **"Set up in 3m 42s"**
- Comparison line: "vs ~{N × baseline} as {N} separate restaurants" — baseline minutes per restaurant is a **config value** (`ONBOARDING_BASELINE_MIN`, default `[30]` — replace with ops' real number).
- Buttons: "Open venue dashboard", "Open guest view (T1)" (new tab to customer app).

Wizard rules: progress saved server-side per step; "Back" never loses data; leaving and returning resumes at the last step.

## 5. Venue dashboard (`/venues/[id]`)

Row of `StatTile`s: Orders today · GMV today · Avg prep time · Active vendors · Setup time.
Below:
- **By vendor** table: vendor, orders, gross, fee, net, avg prep, open/closed toggle.
- **Live orders feed** (stretch): last 10 vendor orders with `StatusChip`, via polling every 5s.
- Failures panel: any `failed` vendor orders with reason + refunded amount.

## 6. Settlements (`/venues/[id]/settlements`)

- Per-vendor summary cards: gross, qlub fee, net payable (from ledger).
- Ledger table: time, vendor, vendor order, type (Sale / Reversal), gross, fee, net. Filters: vendor, type.
- Banner: "Mock ledger — no money moves in this demo."
- Footer check: "Σ vendor net + Σ fees = Σ gross ✓" (computed, shows ✗ in red text if not).

## 7. Component map

`OnboardingTimer`, `StepVenueForm`, `VendorPicker`, `BulkVendorPaste`, `VendorPreviewTable`, `PinRevealModal`, `MenuSyncList`, `QrGrid`, `PrintSheet`, `GoLiveSummary`, `StatTile`, `VendorTable`, `LedgerTable`.

## 8. Acceptance criteria (demo-critical)

- [ ] Fresh venue → live with 4 vendors, menus, 12 QRs in < 5 min, live on stage
- [ ] Setup time and baseline comparison visible on success screen and dashboard
- [ ] Menu sync shows per-vendor result; one simulated failure can be retried
- [ ] QR sheet prints cleanly; scanning a printed QR opens the customer app
- [ ] Dashboard numbers match the settlement ledger
- [ ] PINs shown once and never again
