/**
 * MockPosAdapter — the ONLY place in apps/api that talks HTTP to mock-pos (CLAUDE.md rule 6).
 * Maps the POS's own shapes (string decimal prices, groups/products, checks/tenders) to ours.
 */
import { minorToDecimal, parseDecimalToMinor, type Vendor } from "@one/contracts";
import { config } from "../config";
import { logger } from "../lib/logger";
import { PosError, type PosAdapter, type PosDirectoryEntry, type PosMenu, type PosOrderInput } from "./types";

interface MockPosMenu {
  store: { name: string; currency: string };
  groups: { groupName: string; products: { sku: string; title: string; desc: string; price: string; soldOut: boolean }[] }[];
}
interface MockPosCheck {
  checkId: string;
  checkNumber: number;
  total: string;
  status: string;
}

function keyFor(posVendorId: string) {
  return `${posVendorId}-key`;
}

async function call<T>(posVendorId: string | null, method: string, path: string, body?: unknown): Promise<T> {
  const url = `${config.mockPosUrl}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...(posVendorId ? { "x-pos-key": keyFor(posVendorId) } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(config.posTimeoutMs),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new PosError(isTimeout ? "POS timeout" : "POS unreachable", isTimeout ? "timeout" : "unavailable");
  }
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const code = (json as { code?: string } | null)?.code;
    if (res.status === 503) throw new PosError("POS offline", "unavailable", json);
    if (res.status === 422) throw new PosError(`Item unavailable at POS (${(json as { sku?: string }).sku ?? "?"})`, "rejected", json);
    throw new PosError(`POS error ${res.status}${code ? ` ${code}` : ""}`, "unknown", json);
  }
  return json as T;
}

function requirePosId(vendor: Vendor): string {
  if (!vendor.posVendorId) throw new PosError(`Vendor ${vendor.name} has no POS id`, "rejected");
  return vendor.posVendorId;
}

export const mockPosAdapter: PosAdapter & { listVendors(): Promise<PosDirectoryEntry[]> } = {
  async listVendors() {
    return call<PosDirectoryEntry[]>(null, "GET", "/pos/vendors");
  },

  async getMenu(vendor): Promise<PosMenu> {
    const id = requirePosId(vendor);
    const menu = await call<MockPosMenu>(id, "GET", `/pos/${id}/menu`);
    const currency = menu.store?.currency ?? "AED";
    return {
      source: "pos",
      items: menu.groups.flatMap((g) =>
        g.products.map((p) => ({
          posItemId: p.sku,
          name: p.title,
          description: p.desc ?? "",
          category: g.groupName,
          priceMinor: parseDecimalToMinor(p.price, currency),
          available: !p.soldOut,
          imageUrl: null,
        })),
      ),
    };
  },

  async submitOrder(vendor, order: PosOrderInput) {
    const id = requirePosId(vendor);
    const check = await call<MockPosCheck>(id, "POST", `/pos/${id}/checks`, {
      externalRef: order.externalRef,
      tableName: order.tableLabel,
      items: order.lines.map((l) => ({ sku: l.posItemId, quantity: l.qty, remark: l.note ?? undefined })),
    });
    const posTotal = parseDecimalToMinor(check.total, order.currency);
    if (posTotal !== order.expectedTotalMinor) {
      logger.warn({ vendorId: vendor.id, posTotal, expected: order.expectedTotalMinor, checkId: check.checkId }, "POS total mismatch");
      // ROADMAP: void the orphan check on the POS
      throw new PosError(`Price mismatch with POS (POS ${check.total}, qlub ${minorToDecimal(order.expectedTotalMinor)})`, "mismatch");
    }
    return { posOrderId: check.checkId };
  },

  async updatePaymentStatus(vendor, posOrderId, paidMinor, ref, currency) {
    const id = requirePosId(vendor);
    if (!posOrderId) throw new PosError("Missing POS check id", "rejected");
    const check = await call<MockPosCheck>(id, "POST", `/pos/${id}/checks/${posOrderId}/tenders`, {
      amount: minorToDecimal(paidMinor, currency),
      tenderType: "QLUB",
      reference: ref,
    });
    if (check.status !== "PAID") throw new PosError(`POS did not accept payment (status ${check.status})`, "rejected");
  },

  async closeOrder(vendor, posOrderId) {
    const id = requirePosId(vendor);
    if (!posOrderId) return;
    await call<MockPosCheck>(id, "POST", `/pos/${id}/checks/${posOrderId}/close`);
  },
};
