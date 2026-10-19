"use client";
import { useEffect, useRef } from "react";
import type { Vendor } from "@one/contracts";
import { ACCENT_BG, cn } from "@one/ui";

export function VendorRail({
  vendors,
  activeId,
  onSelect,
  allChip,
}: {
  vendors: Vendor[];
  activeId: string | null;
  onSelect: (vendor: Vendor) => void;
  /** Shown first when the menu is filtered to one vendor. */
  allChip?: { label: string; onClick: () => void };
}) {
  const railRef = useRef<HTMLDivElement>(null);

  // keep the active chip visible inside the horizontal rail (without moving the page)
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !activeId) return;
    const chip = rail.querySelector<HTMLElement>(`[data-vendor-chip="${activeId}"]`);
    if (!chip) return;
    const target = chip.offsetLeft - rail.clientWidth / 2 + chip.clientWidth / 2;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    rail.scrollTo({ left: Math.max(0, target), behavior: reduce ? "auto" : "smooth" });
  }, [activeId]);

  const chipBase =
    "flex h-11 shrink-0 items-center gap-2 rounded-full border px-3 text-small font-semibold transition focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2";

  return (
    <nav aria-label="Stalls" className="sticky top-14 z-20 border-b border-line bg-paper/95 backdrop-blur">
      <div ref={railRef} className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {allChip && (
          <button type="button" onClick={allChip.onClick} className={cn(chipBase, "border-line bg-surface text-ink-soft")}>
            {allChip.label}
          </button>
        )}
        {vendors.map((v) => {
          const active = v.id === activeId;
          return (
            <button
              key={v.id}
              type="button"
              data-vendor-chip={v.id}
              onClick={() => onSelect(v)}
              aria-current={active ? "true" : undefined}
              className={cn(
                chipBase,
                active ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink",
                !v.isOpen && !active && "text-ink-muted",
              )}
            >
              <span aria-hidden>{v.emoji}</span>
              <span className="whitespace-nowrap">{v.name}</span>
              <span className={cn("h-2 w-2 rounded-full", ACCENT_BG[v.accentToken])} aria-hidden />
              {!v.isOpen && <span className="text-micro uppercase">Closed</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
