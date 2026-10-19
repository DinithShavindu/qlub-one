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
    <>
      {/* qlub-style dark band; scrolls away so the sticky row below stays 56px (VendorRail is top-14) */}
      <div className="qlub-pattern h-20" aria-hidden />
      <header className="sticky top-0 z-30 -mt-6 flex h-14 items-center gap-3 rounded-t-xl bg-paper px-4 pt-2">
        <div className="min-w-0 flex-1">
          {tableLabel && <p className="truncate text-body font-medium">Table {tableLabel}</p>}
          <h1 className={tableLabel ? "truncate text-small text-ink-muted" : "truncate text-body font-semibold"}>{venueName}</h1>
        </div>
        <Link
          href={cartHref}
          className="relative flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-line px-4 text-small font-semibold hover:bg-surface-sunk focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2"
          aria-label={cartCount ? `Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}` : "Cart, empty"}
        >
          <ShoppingBag className="h-5 w-5" aria-hidden />
          <span aria-hidden>Cart</span>
          {cartCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-micro font-bold tabular-nums text-on-brand"
              aria-hidden
            >
              {cartCount}
            </span>
          )}
        </Link>
      </header>
    </>
  );
}
