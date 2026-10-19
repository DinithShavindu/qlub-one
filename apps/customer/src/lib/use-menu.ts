"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Vendor } from "@one/contracts";
import { fetchMenu, MENU_STALE_MS, qk } from "./api";

export function useMenu(venueId: string) {
  const query = useQuery({ queryKey: qk.menu(venueId), queryFn: () => fetchMenu(venueId), staleTime: MENU_STALE_MS });
  const vendorsById = useMemo(() => {
    const m = new Map<string, Vendor>();
    for (const v of query.data?.vendors ?? []) m.set(v.vendor.id, v.vendor);
    return m;
  }, [query.data]);
  return { ...query, vendorsById };
}
