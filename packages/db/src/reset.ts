/**
 * `pnpm db:reset` — drop every collection, recreate indexes and seed the demo venues.
 * Prints vendor PINs and guest QR links per venue. All data is fictional.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { parseDecimalToMinor, type AccentToken, type PosMode } from "@one/contracts";
import { COLLECTION_NAMES, closeDb, db, ensureIndexes, getDb, type MenuItemDoc, type VendorDoc } from "./client";
import { env, REPO_ROOT } from "./env";
import { newId, newPin, newQrToken, slugify } from "./ids";
import { STARTER_TABLET_MENU, TABLET_MENUS } from "./tablet-menus";

interface PosSeed {
  posVendorId: string;
  displayName: string;
  emoji: string;
  groups: { groupName: string; products: { sku: string; title: string; desc: string; price: string; soldOut: boolean }[] }[];
}

function readPosSeed(posVendorId: string): PosSeed {
  const path = resolve(REPO_ROOT, "apps/mock-pos/seed", `${posVendorId}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as PosSeed;
}

interface SeedVendor {
  name: string;
  emoji: string;
  posMode: PosMode;
  posVendorId: string | null;
  accent: AccentToken;
  /** Pickup-code letter, unique within the venue. */
  letter: string;
}

interface SeedVenue {
  name: string;
  code: string;
  tableCount: number;
  vendors: SeedVendor[];
}

/**
 * Demo venues. Harbour is the main stage venue (mock_pos vendors + one tablet). The others are
 * tablet-only so they don't share mock-pos stores; each has its own tables and QR tokens, so a
 * scanned QR opens only that venue's stalls.
 */
const SEED_VENUES: SeedVenue[] = [
  {
    name: "Harbour Food Hall (demo)",
    code: "HARBOUR",
    tableCount: 12,
    vendors: [
      { name: "Shawarma Station", emoji: "🌯", posMode: "mock_pos", posVendorId: "pos_shawarma", accent: "vendor-1", letter: "S" },
      { name: "Sushi Corner", emoji: "🍣", posMode: "mock_pos", posVendorId: "pos_sushi", accent: "vendor-2", letter: "C" },
      { name: "Fresh Press Juice", emoji: "🥤", posMode: "mock_pos", posVendorId: "pos_juice", accent: "vendor-3", letter: "F" },
      { name: "Burger Lab", emoji: "🍔", posMode: "tablet", posVendorId: null, accent: "vendor-4", letter: "B" },
    ],
  },
  {
    name: "Marina Night Market (demo)",
    code: "MARINA",
    tableCount: 8,
    vendors: [
      { name: "Taco Wagon", emoji: "🌮", posMode: "tablet", posVendorId: null, accent: "vendor-1", letter: "T" },
      { name: "Dim Sum Den", emoji: "🥟", posMode: "tablet", posVendorId: null, accent: "vendor-2", letter: "D" },
      { name: "Churro Cart", emoji: "🍩", posMode: "tablet", posVendorId: null, accent: "vendor-5", letter: "C" },
    ],
  },
  {
    name: "Downtown Street Eats (demo)",
    code: "DOWNTOWN",
    tableCount: 10,
    vendors: [
      { name: "Pizza Slice", emoji: "🍕", posMode: "tablet", posVendorId: null, accent: "vendor-1", letter: "P" },
      { name: "Curry House", emoji: "🍛", posMode: "tablet", posVendorId: null, accent: "vendor-3", letter: "C" },
      { name: "Poke Bowl Co", emoji: "🥗", posMode: "tablet", posVendorId: null, accent: "vendor-4", letter: "K" },
      { name: "Bean Bar", emoji: "☕", posMode: "tablet", posVendorId: null, accent: "vendor-6", letter: "B" },
    ],
  },
];

interface SeedResult {
  venue: SeedVenue;
  itemCount: number;
  pins: { name: string; pin: string }[];
  tables: { label: string; qrToken: string }[];
}

async function seedVenue(c: Awaited<ReturnType<typeof db>>, v: SeedVenue, now: Date, index: number): Promise<SeedResult> {
  const nowIso = now.toISOString();

  // Venue — pre-built live copy for the guest flow. The wizard creates fresh venues on stage.
  const venueId = newId("ven");
  const setupDurationMs = 3 * 60_000 + 42_000 + index * 17_000;
  await c.venues.insertOne({
    id: venueId,
    name: v.name,
    slug: slugify(v.name),
    code: v.code,
    type: "food_court",
    flow: "qsr",
    gateway: "qlub_test",
    gatewayMerchantId: null,
    currency: "AED",
    timezone: "Asia/Dubai",
    feeBps: 100,
    status: "live",
    setupDurationMs,
    createdAt: nowIso,
  });
  await c.onboardingRuns.insertOne({
    id: newId("run"),
    venueId,
    startedAt: new Date(now.getTime() - setupDurationMs).toISOString(),
    finishedAt: nowIso,
    steps: { venue: nowIso, vendors: nowIso, menus: nowIso, tables: nowIso, live: nowIso },
    currentStep: "live",
  });

  const pins: { name: string; pin: string }[] = [];
  const vendorDocs: VendorDoc[] = [];
  for (const [i, sv] of v.vendors.entries()) {
    const pin = newPin();
    pins.push({ name: sv.name, pin });
    vendorDocs.push({
      id: newId("vdr"),
      venueId,
      name: sv.name,
      slug: slugify(sv.name),
      letter: sv.letter,
      emoji: sv.emoji,
      accentToken: sv.accent,
      posMode: sv.posMode,
      posVendorId: sv.posVendorId,
      isOpen: true,
      sortOrder: i,
      feeBps: null,
      pinHash: await bcrypt.hash(pin, 8),
    });
  }
  await c.vendors.insertMany(vendorDocs);

  // Menus: mock_pos vendors from mock-pos seed (same data the POS serves), tablet from templates.
  const items: MenuItemDoc[] = [];
  for (const vd of vendorDocs) {
    let sort = 0;
    if (vd.posMode === "mock_pos" && vd.posVendorId) {
      for (const g of readPosSeed(vd.posVendorId).groups) {
        for (const p of g.products) {
          items.push({
            id: newId("itm"),
            vendorId: vd.id,
            posItemId: p.sku,
            name: p.title,
            description: p.desc,
            category: g.groupName,
            priceMinor: parseDecimalToMinor(p.price, "AED"),
            imageUrl: null,
            available: !p.soldOut,
            sortOrder: sort++,
            syncedAt: nowIso,
          });
        }
      }
    } else {
      for (const t of TABLET_MENUS[vd.slug] ?? STARTER_TABLET_MENU) {
        items.push({ id: newId("itm"), vendorId: vd.id, ...t, imageUrl: null, available: true, sortOrder: sort++, syncedAt: nowIso });
      }
    }
  }
  await c.menuItems.insertMany(items);

  const tables = Array.from({ length: v.tableCount }, (_, i) => ({
    id: newId("tbl"),
    venueId,
    label: `T${i + 1}`,
    qrToken: newQrToken(),
  }));
  await c.tables.insertMany(tables);

  return { venue: v, itemCount: items.length, pins, tables };
}

async function main() {
  const started = Date.now();
  const d = await getDb();
  const existing = new Set((await d.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of Object.values(COLLECTION_NAMES)) {
    if (existing.has(name)) await d.collection(name).drop();
  }
  await ensureIndexes();
  const c = await db();

  const now = new Date();
  const customerUrl = env("PUBLIC_CUSTOMER_URL", "http://localhost:3000").replace(/\/$/, "");

  const results: SeedResult[] = [];
  for (const [i, v] of SEED_VENUES.entries()) results.push(await seedVenue(c, v, now, i));

  console.log("\n✅ Seeded MongoDB (db: %s) in %dms — %d venues\n", env("MONGODB_DB", "qlub_one"), Date.now() - started, results.length);
  for (const r of results) {
    console.log("━━ %s · code %s · live · %d vendors · %d items", r.venue.name, r.venue.code, r.pins.length, r.itemCount);
    console.log("  Vendor PINs (shown here only):");
    for (const p of r.pins) console.log(`    ${p.name.padEnd(20)} ${p.pin}`);
    console.log(`  Vendor login: http://localhost:3001/login?venue=${r.venue.code}`);
    console.log("  Guest QR links:");
    for (const t of r.tables.slice(0, 3)) console.log(`    ${t.label.padEnd(4)} ${customerUrl}/t/${t.qrToken}`);
    console.log(`    … ${r.tables.length - 3} more in admin → Tables\n`);
  }
  console.log("Admin: http://localhost:3002 (password from .env ADMIN_PASSWORD)\n");
}

main()
  .catch((err) => {
    console.error("db:reset failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
