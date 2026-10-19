"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, UtensilsCrossed } from "lucide-react";
import type { MenuItem, Vendor } from "@one/contracts";
import { ApiClientError, EmptyState, ErrorState, useToast } from "@one/ui";
import { GENERIC_ERROR } from "@/lib/api";
import { getCartStore, useCart, useCartHydrated } from "@/lib/cart-store";
import { useMenu } from "@/lib/use-menu";
import { CartBar } from "./CartBar";
import { ItemSheet } from "./ItemSheet";
import { MenuHeader } from "./MenuHeader";
import { MenuSkeleton } from "./MenuSkeleton";
import { VendorRail } from "./VendorRail";
import { VendorSection } from "./VendorSection";

export function MenuScreen({ venueId, vendorSlug }: { venueId: string; vendorSlug?: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const tableParam = search.get("table");
  const { toast } = useToast();

  const hydrated = useCartHydrated(venueId);
  const lines = useCart(venueId, (s) => s.lines);
  const tableLabel = useCart(venueId, (s) => s.tableLabel);
  const menu = useMenu(venueId);

  useEffect(() => {
    if (hydrated && tableParam) getCartStore(venueId).getState().setTable(tableParam, null);
  }, [hydrated, tableParam, venueId]);

  const allSections = useMemo(
    () => [...(menu.data?.vendors ?? [])].sort((a, b) => a.vendor.sortOrder - b.vendor.sortOrder),
    [menu.data],
  );
  const vendors = useMemo(() => allSections.map((s) => s.vendor), [allSections]);
  const filtered = vendorSlug ? allSections.find((s) => s.vendor.slug === vendorSlug) : undefined;
  const sections = vendorSlug ? (filtered ? [filtered] : []) : allSections;
  const currency = menu.data?.venue.currency ?? "AED";

  /* ── active-chip tracking ── */
  const [activeId, setActiveId] = useState<string | null>(null);
  const sectionEls = useRef(new Map<string, HTMLElement>());
  const suppressUntil = useRef(0);

  useEffect(() => {
    if (filtered) setActiveId(filtered.vendor.id);
  }, [filtered]);

  useEffect(() => {
    if (vendorSlug || !sections.length || typeof IntersectionObserver === "undefined") return;
    const visible = new Set<string>();
    const order = sections.map((s) => s.vendor.id);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.vendorId!;
          if (e.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        if (Date.now() < suppressUntil.current) return;
        const first = order.find((id) => visible.has(id));
        if (first) setActiveId(first);
      },
      { rootMargin: "-128px 0px -55% 0px", threshold: 0 },
    );
    sectionEls.current.forEach((el) => io.observe(el));
    if (!activeId) setActiveId(order[0] ?? null);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-observe only when the section list changes
  }, [vendorSlug, sections.length, menu.data]);

  const scrollToVendor = useCallback(
    (v: Vendor) => {
      if (vendorSlug) {
        router.push(`/v/${venueId}/menu/${v.slug}`);
        return;
      }
      const el = sectionEls.current.get(v.id);
      if (!el) return;
      setActiveId(v.id);
      suppressUntil.current = Date.now() + 800;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    },
    [router, vendorSlug, venueId],
  );

  /* ── cart ── */
  const [sheetItem, setSheetItem] = useState<MenuItem | null>(null);
  const closeSheet = useCallback(() => setSheetItem(null), []);

  const addToCart = useCallback(
    (item: MenuItem, qty: number, note?: string) => {
      const vendor = menu.vendorsById.get(item.vendorId);
      if (!vendor?.isOpen || !item.available) return;
      getCartStore(venueId)
        .getState()
        .add({ menuItemId: item.id, name: item.name, priceMinor: item.priceMinor, vendorId: item.vendorId, note }, qty);
      toast({ title: `Added to ${vendor.name}`, variant: "success", durationMs: 1800 });
    },
    [menu.vendorsById, toast, venueId],
  );

  const qtyByItem = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) m.set(l.menuItemId, (m.get(l.menuItemId) ?? 0) + l.qty);
    return m;
  }, [lines]);
  const itemCount = hydrated ? lines.reduce((a, l) => a + l.qty, 0) : 0;
  const vendorCount = new Set(lines.map((l) => l.vendorId)).size;
  // no quote exists on the menu screen: cached prices are a preview; the cart re-prices server-side
  const previewTotal = lines.reduce((a, l) => a + l.priceMinor * l.qty, 0);

  const cartHref = `/v/${venueId}/cart`;

  /* ── states ── */
  if (menu.isPending) return <MenuSkeleton />;
  if (menu.isError) {
    const err = menu.error;
    if (err instanceof ApiClientError && err.code === "VENUE_NOT_LIVE") {
      return (
        <main className="flex min-h-dvh items-center justify-center">
          <EmptyState icon={<Clock className="h-10 w-10" />} title="Opening soon" body="This venue isn't taking orders yet." />
        </main>
      );
    }
    if (err instanceof ApiClientError && err.status === 404) {
      return (
        <main className="flex min-h-dvh items-center justify-center">
          <EmptyState title="We couldn't find this venue" body="Scan the QR on your table to start again." />
        </main>
      );
    }
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <ErrorState body={GENERIC_ERROR} retry={() => void menu.refetch()} />
      </main>
    );
  }

  const data = menu.data;
  const totalItems = allSections.reduce((a, s) => a + s.categories.reduce((b, c) => b + c.items.length, 0), 0);
  const sheetVendor = sheetItem ? menu.vendorsById.get(sheetItem.vendorId) ?? null : null;

  return (
    <>
      <MenuHeader venueName={data.venue.name} tableLabel={hydrated ? tableLabel : null} cartHref={cartHref} cartCount={itemCount} />
      {vendors.length > 0 && (
        <VendorRail
          vendors={vendors}
          activeId={activeId}
          onSelect={scrollToVendor}
          allChip={vendorSlug ? { label: "All stalls", onClick: () => router.push(`/v/${venueId}/menu`) } : undefined}
        />
      )}
      <main className="pb-32">
        {totalItems === 0 ? (
          <EmptyState icon={<UtensilsCrossed className="h-10 w-10" />} title="No items yet" body="The stalls are still setting up. Check back soon." />
        ) : vendorSlug && !filtered ? (
          <EmptyState
            title="We couldn't find that stall"
            action={
              <Link href={`/v/${venueId}/menu`} className="text-small font-semibold text-brand-strong underline underline-offset-2">
                See all stalls
              </Link>
            }
          />
        ) : (
          sections.map(({ vendor, categories }) => (
            <VendorSection
              key={vendor.id}
              ref={(el) => {
                if (el) sectionEls.current.set(vendor.id, el);
                else sectionEls.current.delete(vendor.id);
              }}
              vendor={vendor}
              categories={categories}
              currency={currency}
              qtyByItem={hydrated ? qtyByItem : new Map()}
              onOpenItem={setSheetItem}
              onQuickAdd={(item) => addToCart(item, 1)}
            />
          ))
        )}
      </main>
      {hydrated && (
        <CartBar href={cartHref} itemCount={itemCount} vendorCount={vendorCount} totalMinor={previewTotal} currency={currency} />
      )}
      <ItemSheet
        item={sheetItem}
        vendor={sheetVendor}
        currency={currency}
        onClose={closeSheet}
        onAdd={(item, qty, note) => {
          addToCart(item, qty, note);
          closeSheet();
        }}
      />
    </>
  );
}
