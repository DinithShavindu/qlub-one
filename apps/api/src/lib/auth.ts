import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { newGuestToken } from "@one/db";
import { config } from "../config";
import { unauthorized } from "./errors";

export const COOKIE = {
  guest: "guest_token",
  vendor: "vendor_session",
  admin: "admin_session",
} as const;

const TWELVE_HOURS = 12 * 60 * 60;

function sign(payload: string): string {
  return createHmac("sha256", config.sessionSecret).update(payload).digest("base64url");
}

/** `<base64url(json)>.<hmac>` — stateless, tamper-evident session token. */
export function encodeSession(data: Record<string, unknown>, ttlSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession<T>(token: string | undefined): (T & { exp: number }) | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as T & { exp: number };
    if (typeof data.exp !== "number" || data.exp * 1000 < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

const cookieOpts = { httpOnly: true, sameSite: "Lax", path: "/" } as const;

/* ── vendor ── */
export interface VendorSession {
  vendorId: string;
  venueId: string;
}

/** Any vendor-panel session: a vendor (vendorId set) or a multivendor venue manager (vendorId null). */
export interface PanelSession {
  role: "vendor" | "manager";
  vendorId: string | null;
  venueId: string;
}

export function setVendorSession(c: Context, s: VendorSession | PanelSession) {
  setCookie(c, COOKIE.vendor, encodeSession({ ...s }, TWELVE_HOURS), { ...cookieOpts, maxAge: TWELVE_HOURS });
}
export function clearVendorSession(c: Context) {
  deleteCookie(c, COOKIE.vendor, { path: "/" });
}
/** Vendor identity ALWAYS comes from the session cookie, never from the request. */
export function requireVendor(c: Context): VendorSession {
  const s = decodeSession<VendorSession>(getCookie(c, COOKIE.vendor));
  if (!s?.vendorId || !s.venueId) throw unauthorized("Vendor session expired — log in with your PIN");
  return { vendorId: s.vendorId, venueId: s.venueId };
}

/** Vendor or manager. Sessions issued before roles existed are vendor sessions. */
export function requirePanel(c: Context): PanelSession {
  const s = decodeSession<Partial<PanelSession>>(getCookie(c, COOKIE.vendor));
  if (!s?.venueId) throw unauthorized("Session expired — log in with your PIN");
  if (s.role === "manager") return { role: "manager", vendorId: null, venueId: s.venueId };
  if (!s.vendorId) throw unauthorized("Session expired — log in with your PIN");
  return { role: "vendor", vendorId: s.vendorId, venueId: s.venueId };
}

/* ── admin ── */
export function setAdminSession(c: Context) {
  setCookie(c, COOKIE.admin, encodeSession({ role: "admin" }, TWELVE_HOURS), { ...cookieOpts, maxAge: TWELVE_HOURS });
}
export function clearAdminSession(c: Context) {
  deleteCookie(c, COOKIE.admin, { path: "/" });
}
export function requireAdmin(c: Context): void {
  const s = decodeSession<{ role: string }>(getCookie(c, COOKIE.admin));
  if (s?.role !== "admin") throw unauthorized("Admin session expired — log in again");
}

export function safeEqual(a: string, b: string): boolean {
  const x = createHmac("sha256", "cmp").update(a).digest();
  const y = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(x, y);
}

/* ── guest ── */
export function getGuestToken(c: Context): string | null {
  const t = getCookie(c, COOKIE.guest);
  return t && t.length >= 16 ? t : null;
}
export function ensureGuestToken(c: Context): string {
  const existing = getGuestToken(c);
  if (existing) return existing;
  const t = newGuestToken();
  setCookie(c, COOKIE.guest, t, { ...cookieOpts, maxAge: 30 * 24 * 60 * 60 });
  return t;
}
