import { z } from "zod";
import {
  AccentToken,
  KdsStatus,
  MasterOrder,
  MenuItem,
  OnboardingRun,
  PosMode,
  SettlementEntry,
  SettlementType,
  Table,
  Vendor,
  VendorOrder,
  VendorOrderStatus,
  Venue,
} from "./entities";

/* ───────────── Customer ───────────── */

export const TableResolveResponse = z.object({
  venue: Venue,
  table: Table,
  vendors: z.array(Vendor),
});
export type TableResolveResponse = z.infer<typeof TableResolveResponse>;

export const MenuCategory = z.object({ name: z.string(), items: z.array(MenuItem) });
export type MenuCategory = z.infer<typeof MenuCategory>;

export const MenuResponse = z.object({
  venue: Venue,
  vendors: z.array(z.object({ vendor: Vendor, categories: z.array(MenuCategory) })),
});
export type MenuResponse = z.infer<typeof MenuResponse>;

export const CartLine = z.object({
  menuItemId: z.string().min(1),
  qty: z.number().int().min(1).max(50),
  note: z.string().trim().max(80).optional(),
});
export type CartLine = z.infer<typeof CartLine>;

export const QuoteRequest = z.object({
  venueId: z.string().min(1),
  tableId: z.string().min(1),
  lines: z.array(CartLine).min(1).max(100),
});
export type QuoteRequest = z.infer<typeof QuoteRequest>;

export const QuoteIssue = z.object({
  menuItemId: z.string(),
  code: z.enum(["ITEM_UNAVAILABLE", "VENDOR_CLOSED", "NOT_FOUND"]),
  message: z.string(),
});
export type QuoteIssue = z.infer<typeof QuoteIssue>;

export const QuoteLine = z.object({
  menuItemId: z.string(),
  name: z.string(),
  qty: z.number().int(),
  unitPriceMinor: z.number().int(),
  lineTotalMinor: z.number().int(),
  note: z.string().nullable(),
});
export type QuoteLine = z.infer<typeof QuoteLine>;

export const QuoteGroup = z.object({
  vendorId: z.string(),
  lines: z.array(QuoteLine),
  subtotalMinor: z.number().int(),
});
export type QuoteGroup = z.infer<typeof QuoteGroup>;

export const QuoteResponse = z.object({
  groups: z.array(QuoteGroup),
  subtotalMinor: z.number().int(),
  totalMinor: z.number().int(),
  currency: z.string(),
  /** Lines that were dropped from the quote and why. Empty when the cart is valid. */
  issues: z.array(QuoteIssue),
});
export type QuoteResponse = z.infer<typeof QuoteResponse>;

/** Demo-only knobs. "fail_one_vendor" forces one vendor group to fail after payment. */
export const Simulate = z.enum(["decline", "fail_one_vendor"]);
export type Simulate = z.infer<typeof Simulate>;

export const CheckoutRequest = QuoteRequest.extend({
  paymentMethod: z.literal("test_card"),
  guestFirstName: z.string().trim().max(20).optional(),
  simulate: Simulate.optional(),
  /** Client-generated per checkout attempt; retries with the same key return the same order. */
  idempotencyKey: z.string().min(8).max(64).optional(),
});
export type CheckoutRequest = z.infer<typeof CheckoutRequest>;

/** Vendor info a guest needs to render the tracker (no PIN, no internal fields beyond public ones). */
export const OrderResponse = z.object({
  masterOrder: MasterOrder,
  vendorOrders: z.array(VendorOrder),
  vendors: z.array(Vendor),
});
export type OrderResponse = z.infer<typeof OrderResponse>;
export const CheckoutResponse = OrderResponse;
export type CheckoutResponse = OrderResponse;

/* ───────────── Vendor ───────────── */

export const VendorVenueLookupResponse = z.object({
  venue: z.object({ id: z.string(), name: z.string(), code: z.string() }),
  vendors: z.array(Vendor.pick({ id: true, name: true, emoji: true, accentToken: true, slug: true, isOpen: true })),
});
export type VendorVenueLookupResponse = z.infer<typeof VendorVenueLookupResponse>;

export const VendorLoginRequest = z.object({
  vendorId: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/),
});
export type VendorLoginRequest = z.infer<typeof VendorLoginRequest>;

export const VendorMeResponse = z.object({ vendor: Vendor, venue: Venue });
export type VendorMeResponse = z.infer<typeof VendorMeResponse>;

export const VendorOrdersResponse = z.object({ vendorOrders: z.array(VendorOrder), todayCount: z.number().int() });
export type VendorOrdersResponse = z.infer<typeof VendorOrdersResponse>;

export const VendorStatusRequest = z.object({ status: KdsStatus });
export type VendorStatusRequest = z.infer<typeof VendorStatusRequest>;

export const VendorHistoryResponse = z.object({
  vendorOrders: z.array(VendorOrder),
  totals: z.object({
    orders: z.number().int(),
    grossMinor: z.number().int(),
    feeMinor: z.number().int(),
    netMinor: z.number().int(),
  }),
  currency: z.string(),
});
export type VendorHistoryResponse = z.infer<typeof VendorHistoryResponse>;

export const VendorItemsResponse = z.object({ items: z.array(MenuItem) });
export type VendorItemsResponse = z.infer<typeof VendorItemsResponse>;

export const AvailabilityRequest = z.object({ available: z.boolean() });
export type AvailabilityRequest = z.infer<typeof AvailabilityRequest>;

/* ───────────── Admin ───────────── */

export const AdminLoginRequest = z.object({ password: z.string().min(1) });

export const CreateVenueRequest = z.object({
  name: z.string().trim().min(2).max(60),
  currency: z.string().length(3).default("AED"),
  timezone: z.string().default("Asia/Dubai"),
  feeBps: z.number().int().min(0).max(2000).default(100),
});
export type CreateVenueRequest = z.infer<typeof CreateVenueRequest>;

export const UpdateVenueRequest = CreateVenueRequest.partial();
export type UpdateVenueRequest = z.infer<typeof UpdateVenueRequest>;

export const BulkVendorInput = z.object({
  name: z.string().trim().min(1).max(40),
  emoji: z.string().trim().min(1).max(8).default("🍽️"),
  posMode: PosMode,
  posVendorId: z.string().optional(),
  accentToken: AccentToken.optional(),
});
export type BulkVendorInput = z.infer<typeof BulkVendorInput>;

export const BulkVendorsRequest = z.object({ vendors: z.array(BulkVendorInput).min(1).max(50) });
export type BulkVendorsRequest = z.infer<typeof BulkVendorsRequest>;

export const BulkVendorsResponse = z.object({
  vendors: z.array(Vendor),
  /** Shown once. Never returned again. */
  pins: z.array(z.object({ vendorId: z.string(), name: z.string(), pin: z.string() })),
});
export type BulkVendorsResponse = z.infer<typeof BulkVendorsResponse>;

export const PosVendor = z.object({ posVendorId: z.string(), displayName: z.string(), emoji: z.string() });
export type PosVendor = z.infer<typeof PosVendor>;
export const PosVendorsResponse = z.object({ vendors: z.array(PosVendor) });
export type PosVendorsResponse = z.infer<typeof PosVendorsResponse>;

export const MenuSyncRequest = z.object({ vendorIds: z.array(z.string()).optional() });
export const MenuSyncResult = z.object({
  vendorId: z.string(),
  ok: z.boolean(),
  itemCount: z.number().int(),
  source: z.enum(["pos", "seed"]),
  error: z.string().nullable(),
  durationMs: z.number().int(),
});
export type MenuSyncResult = z.infer<typeof MenuSyncResult>;
export const MenuSyncResponse = z.object({
  results: z.array(MenuSyncResult),
  totalItems: z.number().int(),
  errors: z.number().int(),
});
export type MenuSyncResponse = z.infer<typeof MenuSyncResponse>;

export const CreateTablesRequest = z.object({
  count: z.number().int().min(1).max(200),
  prefix: z.string().trim().min(0).max(6).default("T"),
});
export type CreateTablesRequest = z.infer<typeof CreateTablesRequest>;

export const TableWithUrl = Table.extend({ url: z.string() });
export type TableWithUrl = z.infer<typeof TableWithUrl>;
export const TablesResponse = z.object({ tables: z.array(TableWithUrl) });
export type TablesResponse = z.infer<typeof TablesResponse>;

export const GoLiveResponse = z.object({
  venue: Venue,
  setupDurationMs: z.number().int(),
  baselineMinPerVendor: z.number(),
  vendorCount: z.number().int(),
});
export type GoLiveResponse = z.infer<typeof GoLiveResponse>;

export const AdminVendor = Vendor.extend({ itemCount: z.number().int() });
export type AdminVendor = z.infer<typeof AdminVendor>;

export const AdminVenueSummary = z.object({
  venue: Venue,
  vendorCount: z.number().int(),
  tableCount: z.number().int(),
  itemCount: z.number().int(),
});
export type AdminVenueSummary = z.infer<typeof AdminVenueSummary>;

export const AdminVenuesResponse = z.object({ venues: z.array(AdminVenueSummary) });
export type AdminVenuesResponse = z.infer<typeof AdminVenuesResponse>;

export const AdminVenueDetailResponse = z.object({
  venue: Venue,
  vendors: z.array(AdminVendor),
  tableCount: z.number().int(),
  itemCount: z.number().int(),
  onboardingRun: OnboardingRun.nullable(),
  baselineMinPerVendor: z.number(),
});
export type AdminVenueDetailResponse = z.infer<typeof AdminVenueDetailResponse>;

export const SetVendorOpenRequest = z.object({ isOpen: z.boolean() });
export const ResetPinResponse = z.object({ vendorId: z.string(), pin: z.string() });
export type ResetPinResponse = z.infer<typeof ResetPinResponse>;

export const VendorStats = z.object({
  vendor: Vendor,
  orders: z.number().int(),
  grossMinor: z.number().int(),
  feeMinor: z.number().int(),
  netMinor: z.number().int(),
  avgPrepSeconds: z.number().int().nullable(),
});
export type VendorStats = z.infer<typeof VendorStats>;

export const DashboardResponse = z.object({
  venue: Venue,
  currency: z.string(),
  ordersToday: z.number().int(),
  gmvMinor: z.number().int(),
  avgPrepSeconds: z.number().int().nullable(),
  activeVendors: z.number().int(),
  totalVendors: z.number().int(),
  setupDurationMs: z.number().int().nullable(),
  baselineMinPerVendor: z.number(),
  byVendor: z.array(VendorStats),
  recentOrders: z.array(VendorOrder),
  failures: z.array(VendorOrder),
});
export type DashboardResponse = z.infer<typeof DashboardResponse>;

export const SettlementRow = SettlementEntry.extend({ pickupCode: z.string() });
export type SettlementRow = z.infer<typeof SettlementRow>;

export const SettlementsResponse = z.object({
  currency: z.string(),
  entries: z.array(SettlementRow),
  byVendor: z.array(
    z.object({ vendor: Vendor, grossMinor: z.number().int(), feeMinor: z.number().int(), netMinor: z.number().int() }),
  ),
  totals: z.object({ grossMinor: z.number().int(), feeMinor: z.number().int(), netMinor: z.number().int() }),
  /** Σ vendor net + Σ fees === Σ gross */
  balanced: z.boolean(),
});
export type SettlementsResponse = z.infer<typeof SettlementsResponse>;
export const SettlementsQuery = z.object({ vendorId: z.string().optional(), type: SettlementType.optional() });

export { VendorOrderStatus };
