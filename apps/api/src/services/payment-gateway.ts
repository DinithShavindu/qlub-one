/**
 * Mock payment gateway. `test_card` only — there are no card fields anywhere in this system.
 * ROADMAP: real gateway + split settlement to vendor bank accounts.
 */
import { ulid } from "ulid";
import { logger } from "../lib/logger";

export type ChargeResult = { ok: true; ref: string } | { ok: false; reason: string };

export async function charge(amountMinor: number, method: "test_card", simulate?: string): Promise<ChargeResult> {
  await new Promise((r) => setTimeout(r, 150)); // feels like a real network call
  if (simulate === "decline") return { ok: false, reason: "Test card declined (simulated)" };
  const ref = `mockpay_${ulid().toLowerCase()}`;
  logger.info({ amountMinor, method, ref }, "mock charge captured");
  return { ok: true, ref };
}

export async function refund(paymentRef: string, amountMinor: number): Promise<{ refundRef: string }> {
  const refundRef = `mockrefund_${ulid().toLowerCase()}`;
  logger.info({ paymentRef, amountMinor, refundRef }, "mock refund issued");
  return { refundRef };
}
