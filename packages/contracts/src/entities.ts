import { z } from "zod";

export const IsoDate = z.string();

export const VenueStatus = z.enum(["draft", "live"]);
/** Multivendor venue kinds. Both group many vendors under one venue, one QR set, one settlement. */
export const VenueType = z.enum(["food_court", "hotel"]);
export type VenueType = z.infer<typeof VenueType>;
export const PosMode = z.enum(["mock_pos", "tablet"]);
export type PosMode = z.infer<typeof PosMode>;

export const AccentToken = z.enum(["vendor-1", "vendor-2", "vendor-3", "vendor-4", "vendor-5", "vendor-6"]);
export type AccentToken = z.infer<typeof AccentToken>;
export const ACCENT_TOKENS = AccentToken.options;

export const Venue = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  /** Short uppercase code staff type on the vendor login screen, e.g. "HARBOUR". */
  code: z.string(),
  type: VenueType,
  currency: z.string(),
  timezone: z.string(),
  feeBps: z.number().int(),
  status: VenueStatus,
  setupDurationMs: z.number().int().nullable(),
  createdAt: IsoDate,
});
export type Venue = z.infer<typeof Venue>;

export const Vendor = z.object({
  id: z.string(),
  venueId: z.string(),
  name: z.string(),
  slug: z.string(),
  /** Pickup-code letter, unique per venue. */
  letter: z.string().length(1),
  emoji: z.string(),
  accentToken: AccentToken,
  posMode: PosMode,
  posVendorId: z.string().nullable(),
  isOpen: z.boolean(),
  sortOrder: z.number().int(),
});
export type Vendor = z.infer<typeof Vendor>;

export const Table = z.object({
  id: z.string(),
  venueId: z.string(),
  label: z.string(),
  qrToken: z.string(),
  /** Set = an individual vendor's QR (scan opens only that vendor). Null/missing = shared venue QR, every vendor. */
  vendorId: z.string().nullable().optional(),
});
export type Table = z.infer<typeof Table>;

export const MenuItem = z.object({
  id: z.string(),
  vendorId: z.string(),
  posItemId: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  priceMinor: z.number().int(),
  imageUrl: z.string().nullable(),
  available: z.boolean(),
  sortOrder: z.number().int(),
  syncedAt: IsoDate,
});
export type MenuItem = z.infer<typeof MenuItem>;

export const MasterOrderStatus = z.enum(["pending_payment", "paid", "partially_failed", "completed", "payment_failed"]);
export type MasterOrderStatus = z.infer<typeof MasterOrderStatus>;

export const MasterOrder = z.object({
  id: z.string(),
  venueId: z.string(),
  tableId: z.string(),
  tableLabel: z.string(),
  guestFirstName: z.string().nullable(),
  status: MasterOrderStatus,
  subtotalMinor: z.number().int(),
  totalMinor: z.number().int(),
  refundedMinor: z.number().int(),
  currency: z.string(),
  paymentRef: z.string().nullable(),
  createdAt: IsoDate,
});
export type MasterOrder = z.infer<typeof MasterOrder>;

export const VendorOrderStatus = z.enum(["submitting", "new", "preparing", "ready", "collected", "failed"]);
export type VendorOrderStatus = z.infer<typeof VendorOrderStatus>;

/** Statuses a vendor may set from the KDS. */
export const KdsStatus = z.enum(["new", "preparing", "ready", "collected"]);
export type KdsStatus = z.infer<typeof KdsStatus>;
export const KDS_FLOW: KdsStatus[] = ["new", "preparing", "ready", "collected"];

export const VendorOrderItem = z.object({
  id: z.string(),
  menuItemId: z.string(),
  posItemId: z.string(),
  name: z.string(),
  qty: z.number().int(),
  unitPriceMinor: z.number().int(),
  lineTotalMinor: z.number().int(),
  note: z.string().nullable(),
});
export type VendorOrderItem = z.infer<typeof VendorOrderItem>;

export const VendorOrder = z.object({
  id: z.string(),
  masterOrderId: z.string(),
  venueId: z.string(),
  vendorId: z.string(),
  posOrderId: z.string().nullable(),
  status: VendorOrderStatus,
  pickupCode: z.string(),
  tableLabel: z.string(),
  guestFirstName: z.string().nullable(),
  currency: z.string(),
  subtotalMinor: z.number().int(),
  feeMinor: z.number().int(),
  netMinor: z.number().int(),
  refundedMinor: z.number().int(),
  failureReason: z.string().nullable(),
  items: z.array(VendorOrderItem),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  preparingAt: IsoDate.nullable(),
  readyAt: IsoDate.nullable(),
  collectedAt: IsoDate.nullable(),
  /** Previous status + when it changed — powers the 30s "Move back" undo. */
  previousStatus: VendorOrderStatus.nullable(),
  statusChangedAt: IsoDate,
});
export type VendorOrder = z.infer<typeof VendorOrder>;

export const SettlementType = z.enum(["sale", "reversal"]);
export const SettlementEntry = z.object({
  id: z.string(),
  venueId: z.string(),
  vendorId: z.string(),
  vendorOrderId: z.string(),
  type: SettlementType,
  grossMinor: z.number().int(),
  feeMinor: z.number().int(),
  netMinor: z.number().int(),
  createdAt: IsoDate,
});
export type SettlementEntry = z.infer<typeof SettlementEntry>;

export const OnboardingStep = z.enum(["venue", "vendors", "menus", "tables", "live"]);
export type OnboardingStep = z.infer<typeof OnboardingStep>;
export const ONBOARDING_STEPS = OnboardingStep.options;

export const OnboardingRun = z.object({
  id: z.string(),
  venueId: z.string(),
  startedAt: IsoDate,
  finishedAt: IsoDate.nullable(),
  /** step -> ISO time it was completed */
  steps: z.record(OnboardingStep, IsoDate.optional()),
  currentStep: OnboardingStep,
});
export type OnboardingRun = z.infer<typeof OnboardingRun>;
