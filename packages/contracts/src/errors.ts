import { z } from "zod";

export const ErrorCode = z.enum([
  "VALIDATION_ERROR",
  "NOT_FOUND",
  "QR_NOT_FOUND",
  "VENUE_NOT_LIVE",
  /** QSR ordering on a pay-at-table venue (or the reverse). */
  "WRONG_FLOW",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "WRONG_PIN",
  "PIN_COOLDOWN",
  "VENDOR_CLOSED",
  "ITEM_UNAVAILABLE",
  "PAYMENT_DECLINED",
  "INVALID_STATUS_TRANSITION",
  "POS_ERROR",
  "CONFLICT",
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
