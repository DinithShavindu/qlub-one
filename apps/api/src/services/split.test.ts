import { describe, expect, it } from "vitest";
import { feeFor, sumMinor, type MenuItem, type Vendor } from "@one/contracts";
import { assertSplitInvariant, ledgerFor, priceCart, splitForVendors } from "./split";
import { assignLetter, venueCodeCandidates } from "./naming";

const VENUE = "ven_1";
function vendor(id: string, sortOrder: number, isOpen = true): Vendor {
  return {
    id, venueId: VENUE, name: id, slug: id, letter: id[0]!.toUpperCase(), emoji: "🍽️", accentToken: "vendor-1",
    posMode: "tablet", posVendorId: null, isOpen, sortOrder,
  };
}
function item(id: string, vendorId: string, priceMinor: number, available = true): MenuItem {
  return { id, vendorId, posItemId: id, name: id, description: "", category: "c", priceMinor, imageUrl: null, available, sortOrder: 0, syncedAt: "" };
}

const vendors = new Map([vendor("shawarma", 0), vendor("sushi", 1), vendor("juice", 2), vendor("closed", 3, false)].map((v) => [v.id, v]));
const items = new Map(
  [
    item("wrap", "shawarma", 1800),
    item("fries", "shawarma", 900),
    item("roll", "sushi", 2800),
    item("miso", "sushi", 900),
    item("oj", "juice", 1400),
    item("odd", "juice", 1005),
    item("soldout", "juice", 500, false),
    item("closedItem", "closed", 1000),
  ].map((i) => [i.id, i]),
);

describe("priceCart + split invariant", () => {
  it("1 vendor", () => {
    const q = priceCart([{ menuItemId: "wrap", qty: 2 }, { menuItemId: "fries", qty: 1 }], items, vendors, VENUE);
    expect(q.groups).toHaveLength(1);
    expect(q.subtotalMinor).toBe(4500);
    expect(q.totalMinor).toBe(4500);
    assertSplitInvariant(q.subtotalMinor, q.groups);
  });

  it("3 vendors, grouped in vendor sortOrder, Σ vendor === master", () => {
    const q = priceCart(
      [{ menuItemId: "oj", qty: 1 }, { menuItemId: "wrap", qty: 1 }, { menuItemId: "roll", qty: 2 }, { menuItemId: "miso", qty: 1 }],
      items, vendors, VENUE,
    );
    expect(q.groups.map((g) => g.vendorId)).toEqual(["shawarma", "sushi", "juice"]);
    expect(q.groups.map((g) => g.subtotalMinor)).toEqual([1800, 6500, 1400]);
    expect(q.subtotalMinor).toBe(9700);
    expect(sumMinor(q.groups.map((g) => g.subtotalMinor))).toBe(q.subtotalMinor);
    const split = splitForVendors(q.groups, 100);
    expect(split.map((s) => s.feeMinor)).toEqual([18, 65, 14]);
    for (const s of split) expect(s.feeMinor + s.netMinor).toBe(s.subtotalMinor);
  });

  it("odd amounts: 1,005 fils at 100 bps → fee 10, net 995", () => {
    const q = priceCart([{ menuItemId: "odd", qty: 1 }], items, vendors, VENUE);
    const [s] = splitForVendors(q.groups, 100);
    expect(s).toMatchObject({ subtotalMinor: 1005, feeMinor: 10, netMinor: 995 });
    expect(feeFor(1005, 100)).toBe(10);
  });

  it("never trusts client prices and merges identical lines", () => {
    const q = priceCart(
      [{ menuItemId: "wrap", qty: 1, note: "no onion" }, { menuItemId: "wrap", qty: 2, note: "no onion" }, { menuItemId: "wrap", qty: 1 }],
      items, vendors, VENUE,
    );
    expect(q.groups[0]!.lines).toHaveLength(2);
    expect(q.groups[0]!.lines[0]).toMatchObject({ qty: 3, lineTotalMinor: 5400, note: "no onion" });
  });

  it("drops sold-out, closed and unknown items into issues", () => {
    const q = priceCart(
      [{ menuItemId: "soldout", qty: 1 }, { menuItemId: "closedItem", qty: 1 }, { menuItemId: "nope", qty: 1 }, { menuItemId: "oj", qty: 1 }],
      items, vendors, VENUE,
    );
    expect(q.issues.map((i) => i.code).sort()).toEqual(["ITEM_UNAVAILABLE", "NOT_FOUND", "VENDOR_CLOSED"]);
    expect(q.subtotalMinor).toBe(1400);
  });

  it("rejects items from another venue", () => {
    const q = priceCart([{ menuItemId: "oj", qty: 1 }], items, vendors, "ven_other");
    expect(q.issues[0]!.code).toBe("NOT_FOUND");
    expect(q.groups).toHaveLength(0);
  });

  it("detects a broken invariant", () => {
    expect(() => assertSplitInvariant(100, [{ subtotalMinor: 60 }, { subtotalMinor: 39 }])).toThrow();
  });
});

describe("ledger", () => {
  it("a successful vendor order books one sale", () => {
    const lines = ledgerFor({ subtotalMinor: 4200, feeMinor: 42, netMinor: 4158 }, true);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.type).toBe("sale");
  });

  it("a failed vendor reversal nets to zero", () => {
    const lines = ledgerFor({ subtotalMinor: 4200, feeMinor: 42, netMinor: 4158 }, false);
    expect(lines.map((l) => l.type)).toEqual(["sale", "reversal"]);
    expect(sumMinor(lines.map((l) => l.grossMinor))).toBe(0);
    expect(sumMinor(lines.map((l) => l.feeMinor))).toBe(0);
    expect(sumMinor(lines.map((l) => l.netMinor))).toBe(0);
  });

  it("Σ net + Σ fee === Σ gross across a mixed outcome", () => {
    const split = splitForVendors([{ vendorId: "a", subtotalMinor: 1005 }, { vendorId: "b", subtotalMinor: 4321 }, { vendorId: "c", subtotalMinor: 777 }], 125);
    const lines = split.flatMap((s, i) => ledgerFor(s, i !== 1));
    const g = sumMinor(lines.map((l) => l.grossMinor));
    expect(sumMinor(lines.map((l) => l.netMinor)) + sumMinor(lines.map((l) => l.feeMinor))).toBe(g);
    expect(g).toBe(1005 + 777);
  });
});

describe("naming", () => {
  it("assigns the seed letters S, C, F, B", () => {
    const used = new Set<string>();
    const out = ["Shawarma Station", "Sushi Corner", "Fresh Press Juice", "Burger Lab"].map((n) => {
      const l = assignLetter(n, used);
      used.add(l);
      return l;
    });
    expect(out).toEqual(["S", "C", "F", "B"]);
  });
  it("venue codes start with the first word", () => {
    expect(venueCodeCandidates("Harbour Food Hall (demo)").slice(0, 2)).toEqual(["HARBOUR", "HFH"]);
  });
});
