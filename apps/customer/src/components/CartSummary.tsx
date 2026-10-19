"use client";
import type { QuoteResponse, Vendor } from "@one/contracts";
import { cn, MoneyText, VendorBadge } from "@one/ui";

export function CartSummary({
  quote,
  vendorsById,
  updating,
}: {
  quote: QuoteResponse;
  vendorsById: Map<string, Vendor>;
  updating?: boolean;
}) {
  return (
    <section className={cn("rounded-lg bg-surface p-4 shadow-card transition-opacity", updating && "opacity-60")} aria-busy={updating}>
      <h2 className="sr-only">Summary</h2>
      <ul className="space-y-2">
        {quote.groups.map((g) => {
          const v = vendorsById.get(g.vendorId);
          return (
            <li key={g.vendorId} className="flex items-center justify-between gap-3 text-small text-ink-soft">
              {v ? <VendorBadge vendor={v} size="sm" /> : <span>Stall</span>}
              <MoneyText minor={g.subtotalMinor} currency={quote.currency} />
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="font-display text-h2 font-bold">Total</span>
        <MoneyText minor={quote.totalMinor} currency={quote.currency} className="font-display text-h2 font-bold" />
      </div>
      <p className="mt-2 text-small text-ink-muted">One payment. We&apos;ll send each stall its part of your order.</p>
    </section>
  );
}
