"use client";
import { Plus } from "lucide-react";
import type { MenuItem } from "@one/contracts";
import { cn, MoneyText } from "@one/ui";

export function MenuItemRow({
  item,
  currency,
  vendorOpen,
  inCartQty,
  onOpen,
  onQuickAdd,
}: {
  item: MenuItem;
  currency: string;
  vendorOpen: boolean;
  inCartQty: number;
  onOpen: () => void;
  onQuickAdd: () => void;
}) {
  const canAdd = vendorOpen && item.available;
  return (
    <li className={cn("flex items-start gap-3 py-3", !canAdd && "opacity-60")}>
      <button
        type="button"
        onClick={onOpen}
        disabled={!canAdd}
        className="flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2 disabled:cursor-default"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">
            {inCartQty > 0 && <span className="mr-1 text-brand-strong tabular-nums">{inCartQty}×</span>}
            {item.name}
          </span>
          {item.description && (
            <span className="mt-0.5 line-clamp-2 block text-small text-ink-muted">{item.description}</span>
          )}
          <span className="mt-1 flex items-center gap-2">
            <MoneyText minor={item.priceMinor} currency={currency} className="text-small font-semibold text-ink-soft" />
            {!item.available && (
              <span className="rounded-sm bg-surface-sunk px-1.5 py-0.5 text-micro font-semibold uppercase text-ink-soft">
                Sold out
              </span>
            )}
          </span>
        </span>
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- POS image hosts are arbitrary
          <img src={item.imageUrl} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-md bg-surface-sunk object-cover" />
        )}
      </button>
      {canAdd && (
        <button
          type="button"
          onClick={onQuickAdd}
          aria-label={`Add ${item.name}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand shadow-card transition hover:brightness-95 active:scale-95 focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2"
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      )}
    </li>
  );
}
