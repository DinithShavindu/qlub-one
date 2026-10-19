"use client";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";

export function MenuHeader({
  venueName,
  tableLabel,
  cartHref,
  cartCount,
}: {
  venueName: string;
  tableLabel: string | null;
  cartHref: string;
  cartCount: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur">
      <h1 className="min-w-0 flex-1 truncate font-display text-body font-bold">{venueName}</h1>
      {tableLabel && (
        <span className="shrink-0 rounded-full bg-surface-sunk px-3 py-1 text-small font-semibold text-ink-soft">
          Table {tableLabel}
        </span>
      )}
      <Link
        href={cartHref}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-surface-sunk focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2"
        aria-label={cartCount ? `Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}` : "Cart, empty"}
      >
        <ShoppingBag className="h-6 w-6" aria-hidden />
        {cartCount > 0 && (
          <span
            className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-micro font-bold tabular-nums text-on-brand"
            aria-hidden
          >
            {cartCount}
          </span>
        )}
      </Link>
    </header>
  );
}
