import type {
  CheckoutRequest,
  CheckoutResponse,
  MenuResponse,
  OrderResponse,
  QuoteRequest,
  QuoteResponse,
  TableResolveResponse,
} from "@one/contracts";
import { apiFetch } from "@one/ui";

/** TanStack Query keys (DESIGN.md §6). */
export const qk = {
  table: (qrToken: string) => ["table", qrToken] as const,
  menu: (venueId: string) => ["menu", venueId] as const,
  quote: (venueId: string, signature: string) => ["quote", venueId, signature] as const,
  order: (masterOrderId: string) => ["order", masterOrderId] as const,
};

export const MENU_STALE_MS = 60_000;

export const resolveTable = (qrToken: string) =>
  apiFetch<TableResolveResponse>(`/v1/t/${encodeURIComponent(qrToken)}`);

export const fetchMenu = (venueId: string) =>
  apiFetch<MenuResponse>(`/v1/venues/${encodeURIComponent(venueId)}/menu`);

export const postQuote = (body: QuoteRequest) =>
  apiFetch<QuoteResponse>("/v1/checkout/quote", { method: "POST", json: body });

export const postCheckout = (body: CheckoutRequest) =>
  apiFetch<CheckoutResponse>("/v1/checkout", { method: "POST", json: body });

export const fetchOrder = (masterOrderId: string) =>
  apiFetch<OrderResponse>(`/v1/orders/${encodeURIComponent(masterOrderId)}`);

export const orderStreamUrl = (masterOrderId: string) => `/v1/orders/${encodeURIComponent(masterOrderId)}/stream`;

export const GENERIC_ERROR = "Something went wrong. Check your connection and try again.";

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
