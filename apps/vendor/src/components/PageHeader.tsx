import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { VendorMeResponse } from "@one/contracts";
import { VendorBadge } from "@one/ui";

export function PageHeader({ me, title }: { me: VendorMeResponse; title: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface pr-4">
      <Link
        href="/"
        className="flex h-16 shrink-0 items-center gap-2 px-4 text-body font-semibold hover:bg-surface-sunk focus-visible:ring-2 focus-visible:ring-brand-strong"
      >
        <ArrowLeft className="h-6 w-6" aria-hidden />
        <span>Board</span>
      </Link>
      <h1 className="min-w-0 flex-1 truncate font-display text-h1 font-bold">{title}</h1>
      <VendorBadge vendor={me.vendor} size="md" className="hidden sm:inline-flex" />
    </header>
  );
}
