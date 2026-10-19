"use client";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@one/ui";
import type { VendorHistoryResponse, VendorItemsResponse, VendorMeResponse, VendorOrdersResponse } from "@one/contracts";

export const qk = {
  me: ["vendor", "me"] as const,
  orders: ["vendor", "orders"] as const,
  history: ["vendor", "history"] as const,
  items: ["vendor", "items"] as const,
};

export const ORDERS_PATH = "/v1/vendor/orders?status=new,preparing,ready";
export const STREAM_PATH = "/v1/vendor/stream";

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: () => apiFetch<VendorMeResponse>("/v1/vendor/me"),
    staleTime: 60_000,
  });
}

export function useOrdersQuery(enabled: boolean) {
  return useQuery({
    queryKey: qk.orders,
    queryFn: () => apiFetch<VendorOrdersResponse>(ORDERS_PATH),
    enabled,
    // safety net in addition to SSE + poll fallback
    refetchInterval: 30_000,
  });
}

export function useHistory() {
  return useQuery({
    queryKey: qk.history,
    queryFn: () => apiFetch<VendorHistoryResponse>("/v1/vendor/history"),
    refetchInterval: 60_000,
  });
}

export function useItems() {
  return useQuery({
    queryKey: qk.items,
    queryFn: () => apiFetch<VendorItemsResponse>("/v1/vendor/items"),
  });
}
