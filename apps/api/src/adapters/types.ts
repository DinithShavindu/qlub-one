import type { Vendor } from "@one/contracts";

/** Menu as the api understands it, already mapped from the POS's own shape. */
export interface PosMenuItem {
  posItemId: string;
  name: string;
  description: string;
  category: string;
  priceMinor: number;
  available: boolean;
  imageUrl: string | null;
}
export interface PosMenu {
  items: PosMenuItem[];
  source: "pos" | "seed";
}

export interface PosLine {
  posItemId: string;
  name: string;
  qty: number;
  unitPriceMinor: number;
  note: string | null;
}

export interface PosQuote {
  totalMinor: number;
}

export interface PosOrderInput {
  /** our vendor order id — the POS uses it as an idempotency key */
  externalRef: string;
  tableLabel: string;
  lines: PosLine[];
  /** api's own quote for this vendor; the adapter fails the order if the POS disagrees */
  expectedTotalMinor: number;
  currency: string;
}

export interface PosDirectoryEntry {
  posVendorId: string;
  displayName: string;
  emoji: string;
}

/**
 * Names mirror qlub's sdk-go adapter methods (GetMenu, CalculateOrder, SubmitOrder,
 * UpdatePaymentStatus, CloseOrder) so this can be ported to a Go adapter later.
 */
export interface PosAdapter {
  getMenu(vendor: Vendor): Promise<PosMenu>;
  calculateOrder?(vendor: Vendor, lines: PosLine[]): Promise<PosQuote>;
  submitOrder(vendor: Vendor, order: PosOrderInput): Promise<{ posOrderId: string | null }>;
  updatePaymentStatus(vendor: Vendor, posOrderId: string | null, paidMinor: number, ref: string, currency: string): Promise<void>;
  closeOrder?(vendor: Vendor, posOrderId: string | null): Promise<void>;
}

/** Thrown by adapters; `message` is safe to show ops and (summarised) guests. */
export class PosError extends Error {
  constructor(
    message: string,
    public kind: "timeout" | "unavailable" | "rejected" | "mismatch" | "unknown",
    public detail?: unknown,
  ) {
    super(message);
  }
}
