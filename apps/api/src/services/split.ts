/**
 * Pure pricing + split logic (ARCHITECTURE.md §6–7). No I/O here so it is easy to test.
 * Invariant: Σ group.subtotalMinor === master.subtotalMinor.
 */
import { assertMinor, splitFee, sumMinor, type CartLine, type MenuItem, type QuoteGroup, type QuoteIssue, type Vendor } from "@one/contracts";

export interface PricedCart {
  groups: QuoteGroup[];
  subtotalMinor: number;
  totalMinor: number;
  issues: QuoteIssue[];
}

/**
 * Price lines server-side from DB items (never from client prices), drop invalid lines into
 * `issues`, and group by vendor in vendor sortOrder. Identical item+note lines are merged.
 */
export function priceCart(
  lines: CartLine[],
  itemsById: Map<string, MenuItem>,
  vendorsById: Map<string, Pick<Vendor, "id" | "name" | "isOpen" | "sortOrder" | "venueId">>,
  venueId: string,
): PricedCart {
  const issues: QuoteIssue[] = [];
  const byVendor = new Map<string, QuoteGroup>();

  for (const line of lines) {
    const item = itemsById.get(line.menuItemId);
    const vendor = item ? vendorsById.get(item.vendorId) : undefined;
    if (!item || !vendor || vendor.venueId !== venueId) {
      issues.push({ menuItemId: line.menuItemId, code: "NOT_FOUND", message: "This item is no longer on the menu." });
      continue;
    }
    if (!vendor.isOpen) {
      issues.push({ menuItemId: item.id, code: "VENDOR_CLOSED", message: `${vendor.name} is closed right now.` });
      continue;
    }
    if (!item.available) {
      issues.push({ menuItemId: item.id, code: "ITEM_UNAVAILABLE", message: `${item.name} is sold out.` });
      continue;
    }
    assertMinor(item.priceMinor);
    const note = line.note?.trim() ? line.note.trim().slice(0, 80) : null;
    let group = byVendor.get(vendor.id);
    if (!group) {
      group = { vendorId: vendor.id, lines: [], subtotalMinor: 0 };
      byVendor.set(vendor.id, group);
    }
    const existing = group.lines.find((l) => l.menuItemId === item.id && l.note === note);
    if (existing) {
      existing.qty += line.qty;
      existing.lineTotalMinor = existing.unitPriceMinor * existing.qty;
    } else {
      group.lines.push({
        menuItemId: item.id,
        name: item.name,
        qty: line.qty,
        unitPriceMinor: item.priceMinor,
        lineTotalMinor: item.priceMinor * line.qty,
        note,
      });
    }
  }

  const groups = [...byVendor.values()]
    .map((g) => ({ ...g, subtotalMinor: sumMinor(g.lines.map((l) => l.lineTotalMinor)) }))
    .sort((a, b) => (vendorsById.get(a.vendorId)!.sortOrder ?? 0) - (vendorsById.get(b.vendorId)!.sortOrder ?? 0));

  const subtotalMinor = sumMinor(groups.map((g) => g.subtotalMinor));
  // MVP: no guest-facing fees/tax/tips
  return { groups, subtotalMinor, totalMinor: subtotalMinor, issues };
}

export interface VendorSplit {
  vendorId: string;
  subtotalMinor: number;
  feeMinor: number;
  netMinor: number;
}

/** qlub fee is per vendor order: fee = round_half_up(subtotal × feeBps / 10 000). */
export function splitForVendors(groups: Pick<QuoteGroup, "vendorId" | "subtotalMinor">[], feeBps: number): VendorSplit[] {
  return groups.map((g) => ({ vendorId: g.vendorId, ...splitFee(g.subtotalMinor, feeBps) }));
}

export function assertSplitInvariant(masterSubtotalMinor: number, parts: { subtotalMinor: number }[]): void {
  const sum = sumMinor(parts.map((p) => p.subtotalMinor));
  if (sum !== masterSubtotalMinor) throw new Error(`split invariant broken: Σ vendor ${sum} !== master ${masterSubtotalMinor}`);
}

export interface LedgerLine {
  type: "sale" | "reversal";
  grossMinor: number;
  feeMinor: number;
  netMinor: number;
}

/**
 * Ledger lines for one vendor order outcome. A failed vendor order records the sale and an
 * equal-and-opposite reversal (the guest's money for that part is refunded), so it nets to zero.
 */
export function ledgerFor(split: Omit<VendorSplit, "vendorId">, ok: boolean): LedgerLine[] {
  const sale: LedgerLine = { type: "sale", grossMinor: split.subtotalMinor, feeMinor: split.feeMinor, netMinor: split.netMinor };
  if (ok) return [sale];
  return [sale, { type: "reversal", grossMinor: -split.subtotalMinor, feeMinor: -split.feeMinor, netMinor: -split.netMinor }];
}
