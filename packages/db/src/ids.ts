import { randomBytes, randomInt } from "node:crypto";
import { ulid } from "ulid";

export type IdPrefix = "ven" | "vdr" | "tbl" | "itm" | "mo" | "vo" | "voi" | "stl" | "run";

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${ulid().toLowerCase()}`;
}

const QR_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Random 16-char URL-safe token for table QR codes. */
export function newQrToken(): string {
  const bytes = randomBytes(16);
  let out = "";
  for (const b of bytes) out += QR_ALPHABET[b % QR_ALPHABET.length];
  return out;
}

export function newGuestToken(): string {
  return randomBytes(24).toString("base64url");
}

export function newPin(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "venue";
}
