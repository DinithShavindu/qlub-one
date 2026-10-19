"use client";
import { Trash2 } from "lucide-react";
import type { QuoteGroup, Vendor } from "@one/contracts";
import { MoneyText, QtyStepper, VendorBadge } from "@one/ui";
import { lineKey, MAX_QTY, type StoredLine } from "@/lib/cart-store";

export function CartVendorGroup({
  vendor,
  lines,
  quoteGroup,
  currency,
  onQty,
  onRemove,
}: {
  vendor: Vendor | undefined;
  lines: StoredLine[];
  quoteGroup: QuoteGroup | undefined;
  currency: string;
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
}) {
  // show the server's numbers once a quote exists; cached prices only as a first paint
  const lineTotal = (l: StoredLine) =>
    quoteGroup?.lines.find((q) => lineKey(q.menuItemId, q.note) === l.key)?.lineTotalMinor ?? l.priceMinor * l.qty;
  const subtotal = quoteGroup?.subtotalMinor ?? lines.reduce((a, l) => a + l.priceMinor * l.qty, 0);

  return (
    <section className="rounded-lg bg-surface p-4 shadow-card">
      <header className="flex items-center justify-between gap-3 border-b border-line pb-3">
        {vendor ? <VendorBadge vendor={vendor} /> : <span className="font-semibold">Stall</span>}
        <MoneyText minor={subtotal} currency={currency} className="text-small font-semibold text-ink-soft" />
      </header>
      <ul className="divide-y divide-line">
        {lines.map((l) => (
          <li key={l.key} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{l.name}</p>
                {l.note && <p className="text-small text-ink-muted">“{l.note}”</p>}
              </div>
              <MoneyText minor={lineTotal(l)} currency={currency} className="shrink-0 font-semibold" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <QtyStepper value={l.qty} min={1} max={MAX_QTY} onChange={(n) => onQty(l.key, n)} label={`Quantity of ${l.name}`} />
              <button
                type="button"
                onClick={() => onRemove(l.key)}
                className="flex h-11 items-center gap-1.5 rounded-md px-3 text-small font-semibold text-ink-soft hover:bg-surface-sunk focus-visible:ring-2 focus-visible:ring-brand-strong"
                aria-label={`Remove ${l.name}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
