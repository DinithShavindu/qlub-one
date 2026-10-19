"use client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@one/ui";
import type {
  VendorDashboardResponse,
  VendorHistoryResponse,
  VendorItemsResponse,
  VendorMeResponse,
  VendorOrderListResponse,
  VendorOrdersResponse,
  VendorPaymentsResponse,
  VendorRange,
  VendorReportsResponse,
  VendorTablesResponse,
} from "@one/contracts";
import { usePanel } from "./panel";

export const qk = {
  me: ["vendor", "me"] as const,
  orders: ["vendor", "orders"] as const,
  history: ["vendor", "history"] as const,
  items: (vendorId: string) => ["vendor", "items", vendorId] as const,
  dashboard: (vendorId: string) => ["vendor", "dashboard", vendorId] as const,
  orderList: (vendorId: string, params: string) => ["vendor", "order-list", vendorId, params] as const,
  payments: (vendorId: string, range: VendorRange) => ["vendor", "payments", vendorId, range] as const,
  reports: (vendorId: string, range: VendorRange) => ["vendor", "reports", vendorId, range] as const,
  tables: (vendorId: string) => ["vendor", "tables", vendorId] as const,
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
  const { vendorId, scoped } = usePanel();
  return useQuery({
    queryKey: qk.items(vendorId),
    queryFn: () => apiFetch<VendorItemsResponse>(scoped("/v1/vendor/items")),
  });
}

export function useDashboard() {
  const { vendorId, scoped } = usePanel();
  return useQuery({
    queryKey: qk.dashboard(vendorId),
    queryFn: () => apiFetch<VendorDashboardResponse>(scoped("/v1/vendor/dashboard")),
    refetchInterval: 15_000,
  });
}

export function useOrderList(params: string) {
  const { vendorId, scoped } = usePanel();
  return useQuery({
    queryKey: qk.orderList(vendorId, params),
    queryFn: () => apiFetch<VendorOrderListResponse>(scoped(`/v1/vendor/orders/list?${params}`)),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function usePayments(range: VendorRange) {
  const { vendorId, scoped } = usePanel();
  return useQuery({
    queryKey: qk.payments(vendorId, range),
    queryFn: () => apiFetch<VendorPaymentsResponse>(scoped(`/v1/vendor/payments?range=${range}`)),
    placeholderData: keepPreviousData,
  });
}

export function useReports(range: VendorRange) {
  const { vendorId, scoped } = usePanel();
  return useQuery({
    queryKey: qk.reports(vendorId, range),
    queryFn: () => apiFetch<VendorReportsResponse>(scoped(`/v1/vendor/reports?range=${range}`)),
    placeholderData: keepPreviousData,
  });
}

export function useTables() {
  const { vendorId, scoped } = usePanel();
  return useQuery({
    queryKey: qk.tables(vendorId),
    queryFn: () => apiFetch<VendorTablesResponse>(scoped("/v1/vendor/tables")),
    refetchInterval: 20_000,
  });
}
