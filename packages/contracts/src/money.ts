/**
 * Money helpers. All amounts are integer minor units (fils for AED). Never floats.
 */

/** round_half_up(subtotalMinor * feeBps / 10_000) using integer math only. */
export function feeFor(subtotalMinor: number, feeBps: number): number {
  assertMinor(subtotalMinor);
  if (!Number.isInteger(feeBps) || feeBps < 0) throw new Error(`invalid feeBps ${feeBps}`);
  const scaled = subtotalMinor * feeBps;
  return Math.floor((scaled + 5_000) / 10_000);
}

export function splitFee(subtotalMinor: number, feeBps: number) {
  const feeMinor = feeFor(subtotalMinor, feeBps);
  return { subtotalMinor, feeMinor, netMinor: subtotalMinor - feeMinor };
}

export function assertMinor(n: number): void {
  if (!Number.isSafeInteger(n)) throw new Error(`money must be an integer minor amount, got ${n}`);
}

export function sumMinor(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

const MINOR_DIGITS: Record<string, number> = { AED: 2, USD: 2, EUR: 2, GBP: 2, SAR: 2, KWD: 3, BHD: 3 };

export function minorDigits(currency: string): number {
  return MINOR_DIGITS[currency] ?? 2;
}

/** "AED 24.00" — currency code always shown. */
export function formatMoney(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const base = 10 ** digits;
  const major = Math.floor(abs / base);
  const frac = String(abs % base).padStart(digits, "0");
  const majorStr = major.toLocaleString("en-US");
  return `${neg ? "-" : ""}${currency} ${majorStr}${digits ? "." + frac : ""}`;
}

/**
 * Parse a decimal string ("18.00", "18", "18.5") into minor units without floats.
 * Throws on anything that is not a plain non-negative decimal.
 */
export function parseDecimalToMinor(value: string, currency = "AED"): number {
  const digits = minorDigits(currency);
  const m = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!m) throw new Error(`invalid decimal amount "${value}"`);
  const whole = m[1]!;
  const frac = (m[2] ?? "").padEnd(digits, "0");
  if (frac.length > digits && /[1-9]/.test(frac.slice(digits))) {
    throw new Error(`amount "${value}" has more precision than ${currency} allows`);
  }
  return Number(whole) * 10 ** digits + Number(frac.slice(0, digits) || "0");
}

/** 1800 -> "18.00" (POS-style decimal string). */
export function minorToDecimal(minor: number, currency = "AED"): string {
  const digits = minorDigits(currency);
  const base = 10 ** digits;
  const major = Math.floor(Math.abs(minor) / base);
  const frac = String(Math.abs(minor) % base).padStart(digits, "0");
  return `${minor < 0 ? "-" : ""}${major}${digits ? "." + frac : ""}`;
}
