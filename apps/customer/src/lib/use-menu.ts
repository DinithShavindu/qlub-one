"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Vendor } from "@one/contracts";
import { fetchMenu, MENU_STALE_MS, qk } from "./api";
import { useCart, useCartHydrated } from "./cart-store";

export function useMenu(venueId: string) {
  // wait for the persisted table so a vendor QR never flashes the whole venue's menu
  const hydrated = useCartHydrated(venueId);
  const tableId = useCart(venueId, (s) => s.tableId);
  const query = useQuery({
    queryKey: qk.menu(venueId, tableId),
    queryFn: () => fetchMenu(venueId, tableId),
    staleTime: MENU_STALE_MS,
    enabled: hydrated,
  });
  const vendorsById = useMemo(() => {
    const m = new Map<string, Vendor>();
    for (const v of query.data?.vendors ?? []) m.set(v.vendor.id, v.vendor);
    return m;
  }, [query.data]);
  return { ...query, vendorsById };
}
