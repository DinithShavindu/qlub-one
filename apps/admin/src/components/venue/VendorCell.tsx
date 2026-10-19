import { Store } from "lucide-react";

/** "All vendors" for a shared venue QR, else the one vendor an individual QR opens. */
export function VendorCell({ vendor }: { vendor: { emoji: string; name: string } | null | undefined }) {
  return vendor ? (
    <span className="inline-flex items-center gap-2 font-semibold">
      <span aria-hidden>{vendor.emoji}</span>
      {vendor.name}
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 text-ink-muted">
      <Store className="h-4 w-4" aria-hidden />
      All vendors
    </span>
  );
}
