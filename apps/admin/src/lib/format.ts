import type { OrderFlow, PaymentGateway, VenueType } from "@one/contracts";

export const VENUE_TYPE_LABEL: Record<VenueType, string> = { restaurant: "Restaurant", food_court: "Food court", hotel: "Hotel" };

export const FLOW_LABEL: Record<OrderFlow, string> = { qsr: "QSR — order & pay", pat: "PAT — pay at table" };
export const FLOW_SHORT: Record<OrderFlow, string> = { qsr: "QSR", pat: "PAT" };
export const FLOW_HINT: Record<OrderFlow, string> = {
  qsr: "Guest scans the QR, orders from the menu and pays; vendors get the order on their kitchen display.",
  pat: "The order is already on the POS. Guest scans the table QR, sees the open bill and pays it.",
};

export const GATEWAY_LABEL: Record<PaymentGateway, string> = {
  qlub_test: "qlub test gateway (sandbox)",
  checkout: "Checkout.com",
  stripe: "Stripe",
  adyen: "Adyen",
};

/** 125 -> "1.25%" */
export const feePct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 2 : 1)}%`;

/** "1.25" -> 125, or null when not a valid 0–20% value with up to 2 decimals. */
export function parseFeePct(s: string): number | null {
  const t = s.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(t) || Number(t) > 20) return null;
  return Math.round(Number(t) * 100);
}

/** 102 -> "01:42"; 3725 -> "1:02:05" — for the live setup timer chip. */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${String(m).padStart(2, "0")}:${sec}`;
}

/** 222 -> "3m 42s", null -> "—" */
export function formatPrep(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

export function baselineLine(vendorCount: number, baselineMinPerVendor: number): string {
  const total = Math.round(vendorCount * baselineMinPerVendor);
  const human = total >= 120 ? `${total} min (${Math.round((total / 60) * 10) / 10} h)` : `${total} min`;
  return `vs ~${human} as ${vendorCount} separate restaurant${vendorCount === 1 ? "" : "s"}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
