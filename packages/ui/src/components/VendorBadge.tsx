import type { AccentToken } from "@one/contracts";
import { ACCENT_BG, cn } from "../utils";

export interface VendorBadgeVendor {
  name: string;
  emoji: string;
  accentToken: AccentToken;
}

const SIZES = {
  sm: { wrap: "gap-1.5 text-small", emoji: "text-base", dot: "h-2 w-2" },
  md: { wrap: "gap-2 text-body font-semibold", emoji: "text-xl", dot: "h-2.5 w-2.5" },
  lg: { wrap: "gap-2.5 text-h2 font-display font-bold", emoji: "text-3xl", dot: "h-3 w-3" },
} as const;

/** Emoji + name + accent dot. The accent is never the only identifier. */
export function VendorBadge({
  vendor,
  size = "md",
  className,
}: {
  vendor: VendorBadgeVendor;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex min-w-0 items-center", s.wrap, className)}>
      <span className={s.emoji} aria-hidden>
        {vendor.emoji}
      </span>
      <span className="truncate">{vendor.name}</span>
      <span className={cn("shrink-0 rounded-full", s.dot, ACCENT_BG[vendor.accentToken])} aria-hidden />
    </span>
  );
}
