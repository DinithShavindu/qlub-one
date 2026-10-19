import { MongoClient, type Collection, type Db, type Document } from "mongodb";
import type {
  MasterOrder,
  MenuItem,
  OnboardingRun,
  SettlementEntry,
  Table,
  Vendor,
  VendorOrder,
  Venue,
} from "@one/contracts";
import { env, requireEnv } from "./env";

/* Documents store the public entity plus internal-only fields. `_id` is Mongo's and never leaves the API. */
export type VenueDoc = Venue;
export type VendorDoc = Vendor & { pinHash: string };
export type TableDoc = Table;
export type MenuItemDoc = MenuItem;
export type MasterOrderDoc = MasterOrder & {
  guestToken: string;
  idempotencyKey: string | null;
};
export type VendorOrderDoc = VendorOrder;
export type SettlementEntryDoc = SettlementEntry;
export type OnboardingRunDoc = OnboardingRun;
export type CounterDoc = { key: string; seq: number };

export interface Collections {
  venues: Collection<VenueDoc>;
  vendors: Collection<VendorDoc>;
  tables: Collection<TableDoc>;
  menuItems: Collection<MenuItemDoc>;
  masterOrders: Collection<MasterOrderDoc>;
  vendorOrders: Collection<VendorOrderDoc>;
  settlements: Collection<SettlementEntryDoc>;
  onboardingRuns: Collection<OnboardingRunDoc>;
  counters: Collection<CounterDoc>;
}

export const COLLECTION_NAMES: Record<keyof Collections, string> = {
  venues: "venues",
  vendors: "vendors",
  tables: "tables",
  menuItems: "menu_items",
  masterOrders: "master_orders",
  vendorOrders: "vendor_orders",
  settlements: "settlement_entries",
  onboardingRuns: "onboarding_runs",
  counters: "counters",
};

let clientPromise: Promise<MongoClient> | null = null;

export function getClient(): Promise<MongoClient> {
  if (!clientPromise) {
    const client = new MongoClient(requireEnv("MONGODB_URI"), {
      appName: "one-venue-one-setup",
      serverSelectionTimeoutMS: 10_000,
    });
    clientPromise = client.connect().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(env("MONGODB_DB", "qlub_one"));
}

let cols: Collections | null = null;

export async function db(): Promise<Collections> {
  if (cols) return cols;
  const d = await getDb();
  const c = (name: string) => d.collection(name);
  cols = {
    venues: c(COLLECTION_NAMES.venues) as unknown as Collection<VenueDoc>,
    vendors: c(COLLECTION_NAMES.vendors) as unknown as Collection<VendorDoc>,
    tables: c(COLLECTION_NAMES.tables) as unknown as Collection<TableDoc>,
    menuItems: c(COLLECTION_NAMES.menuItems) as unknown as Collection<MenuItemDoc>,
    masterOrders: c(COLLECTION_NAMES.masterOrders) as unknown as Collection<MasterOrderDoc>,
    vendorOrders: c(COLLECTION_NAMES.vendorOrders) as unknown as Collection<VendorOrderDoc>,
    settlements: c(COLLECTION_NAMES.settlements) as unknown as Collection<SettlementEntryDoc>,
    onboardingRuns: c(COLLECTION_NAMES.onboardingRuns) as unknown as Collection<OnboardingRunDoc>,
    counters: c(COLLECTION_NAMES.counters) as unknown as Collection<CounterDoc>,
  };
  return cols;
}

export async function ensureIndexes(): Promise<void> {
  const c = await db();
  await Promise.all([
    c.venues.createIndex({ id: 1 }, { unique: true }),
    c.venues.createIndex({ code: 1 }, { unique: true }),
    c.vendors.createIndex({ id: 1 }, { unique: true }),
    c.vendors.createIndex({ venueId: 1, sortOrder: 1 }),
    c.tables.createIndex({ id: 1 }, { unique: true }),
    c.tables.createIndex({ qrToken: 1 }, { unique: true }),
    c.tables.createIndex({ venueId: 1 }),
    c.menuItems.createIndex({ id: 1 }, { unique: true }),
    c.menuItems.createIndex({ vendorId: 1, posItemId: 1 }, { unique: true }),
    c.masterOrders.createIndex({ id: 1 }, { unique: true }),
    c.masterOrders.createIndex({ venueId: 1, createdAt: -1 }),
    c.masterOrders.createIndex(
      { guestToken: 1, idempotencyKey: 1 },
      { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
    ),
    c.vendorOrders.createIndex({ id: 1 }, { unique: true }),
    c.vendorOrders.createIndex({ vendorId: 1, status: 1, createdAt: 1 }),
    c.vendorOrders.createIndex({ masterOrderId: 1 }),
    c.vendorOrders.createIndex({ venueId: 1, createdAt: -1 }),
    c.vendorOrders.createIndex({ posOrderId: 1 }),
    c.settlements.createIndex({ id: 1 }, { unique: true }),
    c.settlements.createIndex({ venueId: 1, createdAt: -1 }),
    c.onboardingRuns.createIndex({ venueId: 1 }),
    c.counters.createIndex({ key: 1 }, { unique: true }),
  ]);
}

/** Projection that hides Mongo's `_id` (and optionally other internal fields). */
export const NO_ID = { projection: { _id: 0 } } as const;

/** Remove `_id` and any listed internal keys from a document. */
export function strip<T extends Document, K extends keyof T = never>(doc: T, ...keys: K[]): Omit<T, "_id" | K> {
  const { _id, ...rest } = doc as T & { _id?: unknown };
  for (const k of keys) delete (rest as Record<string, unknown>)[k as string];
  return rest as Omit<T, "_id" | K>;
}

/** Atomic per-key counter (pickup codes, POS-style sequences). */
export async function nextSeq(key: string): Promise<number> {
  const c = await db();
  const res = await c.counters.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", projection: { _id: 0 } },
  );
  return res?.seq ?? 1;
}

export async function closeDb(): Promise<void> {
  if (clientPromise) {
    const client = await clientPromise;
    await client.close();
    clientPromise = null;
    cols = null;
  }
}
