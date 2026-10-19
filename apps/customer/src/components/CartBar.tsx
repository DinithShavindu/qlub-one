"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatMoney } from "@one/ui";

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function CartBar({
  href,
  itemCount,
  vendorCount,
  totalMinor,
  currency,
}: {
  href: string;
  itemCount: number;
  vendorCount: number;
  totalMinor: number;
  currency: string;
}) {
  if (itemCount <= 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-customer px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <Link
        href={href}
        className="flex min-h-14 animate-slide-up items-center gap-3 rounded-lg bg-ink px-4 py-3 text-paper shadow-sheet focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2"
      >
        <span className="min-w-0 flex-1 text-small font-semibold">
          {plural(itemCount, "item")} from {plural(vendorCount, "vendor")} ·{" "}
          <span className="whitespace-nowrap tabular-nums">{formatMoney(totalMinor, currency)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-small font-bold">
          View cart <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </Link>
    </div>
  );
}
