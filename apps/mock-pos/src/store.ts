/**
 * In-memory "restaurant POS" state. Deliberately its own shapes — this is a third party,
 * it does not know qlub contracts. Resets on restart (or POST /admin/reset).
 */
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";

export interface Product {
  sku: string;
  title: string;
  desc: string;
  price: string;
  soldOut: boolean;
}
export interface Restaurant {
  posVendorId: string;
  displayName: string;
  emoji: string;
  store: { name: string; currency: string; address?: string };
  groups: { groupName: string; products: Product[] }[];
}

export type CheckStatus = "OPEN" | "PAID" | "IN_KITCHEN" | "DONE" | "VOID";

export interface CheckItem {
  sku: string;
  title: string;
  quantity: number;
  remark: string | null;
  priceCents: number;
}
export interface Tender {
  amountCents: number;
  tenderType: string;
  reference: string;
  at: string;
}
export interface Check {
  checkId: string;
  checkNumber: number;
  posVendorId: string;
  externalRef: string;
  tableName: string;
  items: CheckItem[];
  totalCents: number;
  status: CheckStatus;
  tenders: Tender[];
  createdAt: string;
  updatedAt: string;
}

export interface Chaos {
  latencyMs: number | null; // null → env default
  failNextRequests: number;
  down: boolean;
}

const SEED_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../seed");

export const events = new EventEmitter();
events.setMaxListeners(100);

export const state = {
  restaurants: new Map<string, Restaurant>(),
  checks: new Map<string, Map<string, Check>>(), // posVendorId -> checkId -> check
  byExternalRef: new Map<string, string>(), // `${posVendorId}:${externalRef}` -> checkId
  nextCheckNumber: new Map<string, number>(),
  chaos: new Map<string, Chaos>(),
};

export function loadSeed(): void {
  state.restaurants.clear();
  state.checks.clear();
  state.byExternalRef.clear();
  state.nextCheckNumber.clear();
  state.chaos.clear();
  for (const f of readdirSync(SEED_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const r = JSON.parse(readFileSync(resolve(SEED_DIR, f), "utf8")) as Restaurant;
    state.restaurants.set(r.posVendorId, r);
    state.checks.set(r.posVendorId, new Map());
    state.nextCheckNumber.set(r.posVendorId, 1001);
    state.chaos.set(r.posVendorId, { latencyMs: null, failNextRequests: 0, down: false });
  }
  emitChange("reset");
}

export function emitChange(kind: string, posVendorId?: string, checkId?: string): void {
  events.emit("change", { kind, posVendorId, checkId, at: new Date().toISOString() });
}

/* ── money: POS speaks decimal strings, stores cents ── */
export function toCents(price: string): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price.trim());
  if (!m) throw new Error(`bad price ${price}`);
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}
export function toDecimal(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function findProduct(r: Restaurant, sku: string): Product | undefined {
  for (const g of r.groups) {
    const p = g.products.find((x) => x.sku === sku);
    if (p) return p;
  }
  return undefined;
}

export function newCheckId(): string {
  return `chk_${randomBytes(6).toString("hex")}`;
}

export function paidCents(c: Check): number {
  return c.tenders.reduce((a, t) => a + t.amountCents, 0);
}

export function serializeCheck(c: Check) {
  return {
    checkId: c.checkId,
    checkNumber: c.checkNumber,
    externalRef: c.externalRef,
    tableName: c.tableName,
    items: c.items.map((i) => ({
      sku: i.sku,
      title: i.title,
      quantity: i.quantity,
      remark: i.remark,
      price: toDecimal(i.priceCents),
      lineTotal: toDecimal(i.priceCents * i.quantity),
    })),
    total: toDecimal(c.totalCents),
    paid: toDecimal(paidCents(c)),
    status: c.status,
    tenders: c.tenders.map((t) => ({ amount: toDecimal(t.amountCents), tenderType: t.tenderType, reference: t.reference, at: t.at })),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
