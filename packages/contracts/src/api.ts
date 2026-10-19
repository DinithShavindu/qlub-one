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
  OrderFlow,
  PaymentGateway,
  Venue,
  VenueType,
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

/** `vendor` = one restaurant's staff; `manager` = a multivendor venue's manager, sees every vendor. */
export const VendorRole = z.enum(["vendor", "manager"]);
export type VendorRole = z.infer<typeof VendorRole>;

export const VendorVenueLookupResponse = z.object({
  venue: z.object({ id: z.string(), name: z.string(), code: z.string(), type: VenueType, hasManager: z.boolean() }),
  vendors: z.array(Vendor.pick({ id: true, name: true, emoji: true, accentToken: true, slug: true, isOpen: true })),
});
export type VendorVenueLookupResponse = z.infer<typeof VendorVenueLookupResponse>;

/** Vendor login: `vendorId` + PIN. Venue manager login: `venueId` + manager PIN. */
export const VendorLoginRequest = z
  .object({
    vendorId: z.string().min(1).optional(),
    venueId: z.string().min(1).optional(),
    pin: z.string().regex(/^\d{4}$/),
  })
  .refine((r) => !!r.vendorId !== !!r.venueId, { message: "Send vendorId or venueId" });
export type VendorLoginRequest = z.infer<typeof VendorLoginRequest>;

export const VendorMeResponse = z.object({
  role: VendorRole,
  /** The signed-in vendor; null for a venue manager. */
  vendor: Vendor.nullable(),
  /** Vendors this session can see: just `vendor`, or every vendor of the venue for a manager. */
  vendors: z.array(Vendor),
  venue: Venue,
});
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

export const VendorRange = z.enum(["today", "7d", "30d"]);
export type VendorRange = z.infer<typeof VendorRange>;

const Money = z.object({ grossMinor: z.number().int(), feeMinor: z.number().int(), netMinor: z.number().int() });

export const VendorDashboardResponse = z.object({
  currency: z.string(),
  /** Live board counts right now. */
  open: z.object({ new: z.number().int(), preparing: z.number().int(), ready: z.number().int() }),
  today: Money.extend({ orders: z.number().int(), avgPrepSeconds: z.number().int().nullable(), avgTicketMinor: z.number().int().nullable() }),
  byVendor: z.array(Money.extend({ vendor: Vendor, orders: z.number().int(), avgPrepSeconds: z.number().int().nullable() })),
  recentOrders: z.array(VendorOrder),
});
export type VendorDashboardResponse = z.infer<typeof VendorDashboardResponse>;

export const VendorOrderListResponse = z.object({
  rows: z.array(VendorOrder),
  count: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type VendorOrderListResponse = z.infer<typeof VendorOrderListResponse>;

export const VendorPaymentsResponse = z.object({
  currency: z.string(),
  entries: z.array(SettlementEntry.extend({ pickupCode: z.string(), tableLabel: z.string() })),
  totals: Money.extend({ sales: z.number().int(), reversals: z.number().int() }),
});
export type VendorPaymentsResponse = z.infer<typeof VendorPaymentsResponse>;

export const VendorReportsResponse = z.object({
  currency: z.string(),
  /** One row per local date, oldest first, zero-filled. */
  days: z.array(Money.extend({ date: z.string(), orders: z.number().int() })),
  topItems: z.array(z.object({ name: z.string(), vendorId: z.string(), qty: z.number().int(), grossMinor: z.number().int() })),
  byVendor: z.array(Money.extend({ vendor: Vendor, orders: z.number().int() })),
});
export type VendorReportsResponse = z.infer<typeof VendorReportsResponse>;

export const VendorTableRow = Table.extend({ url: z.string(), openOrders: z.number().int() });
export type VendorTableRow = z.infer<typeof VendorTableRow>;
export const VendorTablesResponse = z.object({ tables: z.array(VendorTableRow) });
export type VendorTablesResponse = z.infer<typeof VendorTablesResponse>;

/** Manager picks the vendor; a vendor session ignores it and acts on itself. */
export const VendorSyncRequest = z.object({ vendorId: z.string().min(1).optional() });
export const TableSyncResponse = z.object({
  vendorId: z.string(),
  /** Tables on the POS floor plan. */
  posTables: z.number().int(),
  created: z.number().int(),
  /** Existing qlub tables matched to a POS table by name. */
  linked: z.number().int(),
});
export type TableSyncResponse = z.infer<typeof TableSyncResponse>;

/* ───────────── Admin ───────────── */

export const AdminLoginRequest = z.object({ password: z.string().min(1) });

const FeeBps = z.number().int().min(0).max(2000);

export const CreateVenueRequest = z.object({
  name: z.string().trim().min(2).max(60),
  type: VenueType.default("food_court"),
  flow: OrderFlow.default("qsr"),
  gateway: PaymentGateway.default("qlub_test"),
  gatewayMerchantId: z.string().trim().max(60).nullable().default(null),
  currency: z.string().length(3).default("AED"),
  timezone: z.string().default("Asia/Dubai"),
  feeBps: FeeBps.default(100),
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

export const UpdateVendorRequest = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  emoji: z.string().trim().min(1).max(8).optional(),
  posMode: PosMode.optional(),
  posVendorId: z.string().nullable().optional(),
  /** null = use the venue commission. */
  feeBps: FeeBps.nullable().optional(),
});
export type UpdateVendorRequest = z.infer<typeof UpdateVendorRequest>;

/** One call creates a live single-restaurant venue: venue + its vendor + menu + table QRs. */
export const CreateRestaurantRequest = z.object({
  name: z.string().trim().min(2).max(40),
  emoji: z.string().trim().min(1).max(8).default("🍽️"),
  posMode: PosMode,
  posVendorId: z.string().optional(),
  tableCount: z.number().int().min(0).max(200).default(10),
  flow: OrderFlow.default("qsr"),
  gateway: PaymentGateway.default("qlub_test"),
  gatewayMerchantId: z.string().trim().max(60).nullable().default(null),
  feeBps: FeeBps.default(100),
});
export type CreateRestaurantRequest = z.infer<typeof CreateRestaurantRequest>;

export const CreateRestaurantResponse = z.object({
  venue: Venue,
  vendor: Vendor,
  pin: z.string(),
  itemCount: z.number().int(),
  tableCount: z.number().int(),
  menuError: z.string().nullable(),
});
export type CreateRestaurantResponse = z.infer<typeof CreateRestaurantResponse>;

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
  /** Create QRs for one vendor only. Omitted = shared venue QRs. */
  vendorId: z.string().min(1).optional(),
});
export type CreateTablesRequest = z.infer<typeof CreateTablesRequest>;

export const TableWithUrl = Table.extend({ url: z.string() });
export type TableWithUrl = z.infer<typeof TableWithUrl>;
export const TablesResponse = z.object({ tables: z.array(TableWithUrl) });
export type TablesResponse = z.infer<typeof TablesResponse>;

/** Comma-separated query value -> trimmed, non-empty list. */
const csv = z
  .string()
  .optional()
  .transform((s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined));

/** `GET /v1/admin/qr/list` — QRs across venues. No venue filter = every venue combined. */
export const QrListQuery = z.object({
  /** Venue code or slug, e.g. `HARBOUR` or `harbour-food-hall-demo`. */
  venue: z.string().trim().min(1).optional(),
  venueIds: csv,
  /**
   * Omitted = combined (every QR). `shared` = venue-wide QRs only, `individual` = vendor QRs only,
   * otherwise one vendor: its id, or its slug together with `venue`.
   */
  vendor: z.string().trim().min(1).optional(),
  /** Only these table ids (export of a selection). */
  ids: csv,
  tableName: z.string().trim().max(40).optional(),
  tableId: z.string().trim().max(40).optional(),
  /** 0-based. */
  page: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export type QrListQuery = z.infer<typeof QrListQuery>;

export const QrListRow = TableWithUrl.extend({
  venue: Venue.pick({ id: true, name: true, code: true, slug: true, type: true }),
  /** Null for a shared venue QR. */
  vendor: Vendor.pick({ id: true, name: true, slug: true, emoji: true }).nullable(),
});
export type QrListRow = z.infer<typeof QrListRow>;

export const QrListResponse = z.object({
  rows: z.array(QrListRow),
  /** Total matching rows across all pages. */
  count: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type QrListResponse = z.infer<typeof QrListResponse>;

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
  /** Whether a venue manager PIN has been set (multivendor login to the vendor panel). */
  hasManagerPin: z.boolean(),
});
export type AdminVenueDetailResponse = z.infer<typeof AdminVenueDetailResponse>;

export const SetVendorOpenRequest = z.object({ isOpen: z.boolean() });
export const ResetPinResponse = z.object({ vendorId: z.string(), pin: z.string() });
export const ManagerPinResponse = z.object({ venueId: z.string(), pin: z.string() });
export type ManagerPinResponse = z.infer<typeof ManagerPinResponse>;
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
