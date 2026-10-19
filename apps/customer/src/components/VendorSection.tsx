"use client";
import { forwardRef } from "react";
import type { MenuCategory, MenuItem, Vendor } from "@one/contracts";
import { VendorBadge } from "@one/ui";
import { MenuItemRow } from "./MenuItemRow";

export const VendorSection = forwardRef<
  HTMLElement,
  {
    vendor: Vendor;
    categories: MenuCategory[];
    currency: string;
    qtyByItem: Map<string, number>;
    onOpenItem: (item: MenuItem) => void;
    onQuickAdd: (item: MenuItem) => void;
  }
>(function VendorSection({ vendor, categories, currency, qtyByItem, onOpenItem, onQuickAdd }, ref) {
  const headingId = `vendor-heading-${vendor.id}`;
  const empty = categories.every((c) => c.items.length === 0);
  return (
    <section ref={ref} id={`vendor-${vendor.slug}`} data-vendor-id={vendor.id} aria-labelledby={headingId} className="scroll-mt-32 px-4 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="min-w-0">
          <VendorBadge vendor={vendor} size="lg" />
        </h2>
        {vendor.isOpen ? (
          <span className="shrink-0 text-small text-ink-muted">~10 min</span>
        ) : (
          <span className="shrink-0 rounded-sm bg-surface-sunk px-2 py-1 text-micro font-semibold uppercase text-ink-soft">Closed</span>
        )}
      </div>
      {!vendor.isOpen && <p className="mt-1 text-small text-ink-muted">{vendor.name} isn&apos;t taking orders right now.</p>}
      {empty ? (
        <p className="py-4 text-small text-ink-muted">No items yet</p>
      ) : (
        categories.map((cat) =>
          cat.items.length ? (
            <div key={cat.name} className="mt-4">
              <h3 className="text-micro font-semibold uppercase text-ink-muted">{cat.name}</h3>
              <ul className="divide-y divide-line">
                {cat.items.map((item) => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    currency={currency}
                    vendorOpen={vendor.isOpen}
                    inCartQty={qtyByItem.get(item.id) ?? 0}
                    onOpen={() => onOpenItem(item)}
                    onQuickAdd={() => onQuickAdd(item)}
                  />
                ))}
              </ul>
            </div>
          ) : null,
        )
      )}
    </section>
  );
});
