# Design System — One Venue, One Setup

Shared by all three frontends (customer, vendor, admin) and the mock-pos UI.
Implemented as a Tailwind preset + React components in `packages/ui`.
**Apps must use tokens, never raw hex.**

## 1. Principles

1. **Speed over decoration.** Every screen answers one question in under 2 seconds.
2. **Vendor is always visible.** Wherever an item, line or order appears, show which vendor it belongs to (emoji + name + vendor accent).
3. **Status is text first, color second.** Every status chip says the word ("Ready"), never color alone.
4. **Thumb and tablet friendly.** Min tap target 44px (customer), 64px (vendor KDS).
5. **Calm by default, loud when it matters.** Only "Ready" and errors use strong color/motion.

## 2. Color tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `ink` | `#12161F` | `#F6F4EF` | primary text, dark surfaces |
| `ink-soft` | `#3E4553` | `#C9CDD6` | body text |
| `ink-muted` | `#6B7280` | `#9AA1AE` | captions, meta (≥ 4.5:1 on `paper`) |
| `paper` | `#F6F4EF` | `#12161F` | app background |
| `surface` | `#FFFDF8` | `#1C2230` | cards, sheets |
| `surface-sunk` | `#ECE8DF` | `#0D1017` | wells, table stripes |
| `line` | `#E2DDD2` | `#2A3142` | borders, dividers |
| `brand` | `#E2672B` | `#F0A27A` | primary buttons, accents (large text / fills only) |
| `brand-strong` | `#B9501C` | `#F0A27A` | brand text on light (≥ 4.5:1) |
| `on-brand` | `#12161F` | `#12161F` | text on `brand` fills |

### Status tokens (colorblind-safe: they also differ in lightness, and always carry a label)

| Status | Token | Fill | Text | Icon |
|---|---|---|---|---|
| New | `status-new` | `#DCE7F7` | `#1E4E8C` | `Bell` |
| Preparing | `status-prep` | `#FBE3D5` | `#8A3612` | `ChefHat` |
| Ready | `status-ready` | `#1E4E8C` | `#FFFFFF` | `CheckCircle` |
| Collected | `status-done` | `#ECE8DF` | `#3E4553` | `Check` |
| Failed | `status-failed` | `#FDE2E1` | `#9B1C1C` | `AlertTriangle` |

### Vendor accents (assigned in seed / admin, used for chips & cart group headers)

`vendor-1 #2F5DA8` · `vendor-2 #B9501C` · `vendor-3 #2E7D5B` · `vendor-4 #7A4FB5` · `vendor-5 #A0782A` · `vendor-6 #3E4553`
Always pair with vendor name/emoji — never the only identifier.

## 3. Typography

- Display: **Space Grotesk** 500/700 (headings, big numbers, pickup codes)
- Text: **DM Sans** 400/600 (everything else)
- Load via `next/font/google` in `packages/ui/fonts.ts`.

| Token | Size / line | Use |
|---|---|---|
| `display` | 40/44 (vendor KDS: 56/60) | pickup codes, KPI numbers |
| `h1` | 28/34 | screen titles |
| `h2` | 22/28 | section titles, vendor names |
| `body` | 16/24 | default |
| `small` | 14/20 | meta, captions |
| `micro` | 12/16 | badges only, uppercase, +0.04em |

Numbers use `tabular-nums`.

## 4. Spacing, radius, elevation

- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64.
- Radius: `sm 8` (chips), `md 12` (inputs, buttons), `lg 16` (cards), `xl 24` (sheets).
- Elevation: `shadow-card: 0 1px 2px rgba(18,22,31,.06), 0 4px 12px rgba(18,22,31,.06)`; sheets add `0 -8px 24px rgba(18,22,31,.12)`.
- Layout widths: customer max 480px centered; admin content max 1200px; vendor full-bleed.

## 5. Components (`packages/ui`)

Built on shadcn/ui primitives, restyled with tokens.

| Component | Props (key) | Notes |
|---|---|---|
| `Button` | `variant: primary \| secondary \| ghost \| danger`, `size: md \| lg \| xl`, `loading` | `xl` = 64px for KDS |
| `MoneyText` | `minor, currency` | uses `formatMoney`; tabular |
| `VendorBadge` | `vendor`, `size` | emoji + name + accent dot |
| `StatusChip` | `status` | label + icon + status token |
| `PickupCode` | `code` | display font, high contrast |
| `QtyStepper` | `value, onChange, min, max` | 44px targets |
| `Sheet` | bottom sheet (customer) / side sheet (admin) | |
| `EmptyState` | `icon, title, body, action?` | required on every list |
| `ErrorState` | `title, body, retry` | required on every fetch |
| `Skeleton` | – | loading placeholders matching final layout |
| `Toast` | `variant: info \| success \| error` | |
| `StepWizard` | `steps[], current` | admin onboarding |
| `StatTile` | `label, value, delta?` | admin dashboard |
| `QrCard` | `table, url` | admin QR sheet; SVG QR + label |
| `ConnectionDot` | `state: live \| reconnecting \| offline` | shows SSE health on vendor + tracker |

Helpers: `formatMoney(minor, currency)`, `formatTimeAgo(iso)`, `cn()`.

## 6. Motion

- Default transition 150ms ease-out; sheets 220ms.
- "Ready" moment (customer tracker): status card scales 1 → 1.03 → 1 + `navigator.vibrate(200)` + short chime (respect mute toggle).
- New order on KDS: card slides in from top + 2 beeps; pulsing border for 10s.
- Respect `prefers-reduced-motion`: replace movement with a color/border change.

## 7. Accessibility checklist

- Text contrast ≥ 4.5:1 (≥ 3:1 for ≥ 24px bold). Tokens above are pre-checked.
- Every icon-only button has `aria-label`.
- Status changes announced via `aria-live="polite"` region (tracker, KDS).
- Focus rings visible (`ring-2 ring-brand-strong ring-offset-2`).
- Forms: labels always visible, errors in text under the field.

## 8. Voice & copy

- Short, plain, friendly. "Your shawarma is ready — pick up at Shawarma Station, code S-07."
- Never blame the guest. "Sushi Corner couldn't take your order — we've refunded AED 42.00 for those items."
- Admin copy is operational: "3 vendors synced · 47 items · 0 errors".
- Currency always with code: `AED 24.00`.
