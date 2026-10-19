import { z } from "zod";
import { MasterOrderStatus, VendorOrder, VendorOrderStatus } from "./entities";

/** SSE envelope: `{ type, at, data }`. The SSE `event:` field carries `type` too. */
export const VendorOrderCreatedEvent = z.object({
  type: z.literal("vendor_order.created"),
  at: z.string(),
  data: VendorOrder,
});
export const VendorOrderUpdatedEvent = z.object({
  type: z.literal("vendor_order.updated"),
  at: z.string(),
  data: z.object({ vendorOrderId: z.string(), status: VendorOrderStatus, pickupCode: z.string() }),
});
export const VendorOrderFailedEvent = z.object({
  type: z.literal("vendor_order.failed"),
  at: z.string(),
  data: z.object({ vendorOrderId: z.string(), reason: z.string(), refundedMinor: z.number().int() }),
});
export const MasterOrderUpdatedEvent = z.object({
  type: z.literal("master_order.updated"),
  at: z.string(),
  data: z.object({ masterOrderId: z.string(), status: MasterOrderStatus }),
});
export const HeartbeatEvent = z.object({ type: z.literal("heartbeat"), at: z.string(), data: z.object({}) });

export const SseEvent = z.discriminatedUnion("type", [
  VendorOrderCreatedEvent,
  VendorOrderUpdatedEvent,
  VendorOrderFailedEvent,
  MasterOrderUpdatedEvent,
  HeartbeatEvent,
]);
export type SseEvent = z.infer<typeof SseEvent>;
export type SseEventType = SseEvent["type"];
export const SSE_EVENT_TYPES: SseEventType[] = [
  "vendor_order.created",
  "vendor_order.updated",
  "vendor_order.failed",
  "master_order.updated",
  "heartbeat",
];
