"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@one/ui";
import type {
  AdminVenueDetailResponse,
  AdminVenuesResponse,
  DashboardResponse,
  PosVendorsResponse,
  QrListResponse,
  SettlementsResponse,
  TablesResponse,
} from "@one/contracts";

export const qk = {
  me: ["me"] as const,
  venues: ["venues"] as const,
  venue: (id: string) => ["venue", id] as const,
  dashboard: (id: string) => ["dashboard", id] as const,
  tables: (id: string) => ["tables", id] as const,
  settlements: (id: string, vendorId: string, type: string) => ["settlements", id, vendorId, type] as const,
  posVendors: ["pos-vendors"] as const,
  qrList: (params: string) => ["qr-list", params] as const,
};

/** Builds the `/v1/admin/qr/list` query string; empty values are dropped. */
export function qrListParams(p: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== "") q.set(k, String(v));
  return q.toString();
}

export function useQrList(params: string, enabled = true) {
  return useQuery({
    queryKey: qk.qrList(params),
    queryFn: () => apiFetch<QrListResponse>(`/v1/admin/qr/list?${params}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: () => apiFetch<{ ok: true }>("/v1/admin/me"), staleTime: 60_000 });
}

export function useVenues() {
  return useQuery({ queryKey: qk.venues, queryFn: () => apiFetch<AdminVenuesResponse>("/v1/admin/venues") });
}

export function useVenue(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.venue(id ?? ""),
    queryFn: () => apiFetch<AdminVenueDetailResponse>(`/v1/admin/venues/${id}`),
    enabled: !!id,
  });
}

export function useDashboard(id: string) {
  return useQuery({
    queryKey: qk.dashboard(id),
    queryFn: () => apiFetch<DashboardResponse>(`/v1/admin/venues/${id}/dashboard`),
    refetchInterval: 5_000,
  });
}

export function useTables(id: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.tables(id ?? ""),
    queryFn: () => apiFetch<TablesResponse>(`/v1/admin/venues/${id}/tables`),
    enabled: !!id && enabled,
  });
}

export function useSettlements(id: string, vendorId: string, type: string) {
  return useQuery({
    queryKey: qk.settlements(id, vendorId, type),
    queryFn: () => {
      const q = new URLSearchParams();
      if (vendorId) q.set("vendorId", vendorId);
      if (type) q.set("type", type);
      const s = q.toString();
      return apiFetch<SettlementsResponse>(`/v1/admin/venues/${id}/settlements${s ? `?${s}` : ""}`);
    },
    refetchInterval: 10_000,
  });
}

export function usePosVendors() {
  return useQuery({ queryKey: qk.posVendors, queryFn: () => apiFetch<PosVendorsResponse>("/v1/admin/pos/vendors"), staleTime: 60_000 });
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}
