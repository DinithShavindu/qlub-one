import type { MenuSyncResult, Vendor } from "@one/contracts";
import { db, newId, NO_ID } from "@one/db";
import { adapterFor } from "../adapters";
import { logger } from "../lib/logger";
import { nowIso } from "../lib/time";

/** Pull one vendor's menu through its adapter and upsert it (idempotent on posItemId). */
export async function syncVendorMenu(vendor: Vendor): Promise<MenuSyncResult> {
  const t0 = Date.now();
  try {
    const menu = await adapterFor(vendor).getMenu(vendor);
    const c = await db();
    const now = nowIso();
    const existing = await c.menuItems.find({ vendorId: vendor.id }, NO_ID).toArray();
    const byPosId = new Map(existing.map((i) => [i.posItemId, i]));
    const seen = new Set<string>();
    const ops = menu.items.map((it, sortOrder) => {
      seen.add(it.posItemId);
      const prior = byPosId.get(it.posItemId);
      return {
        updateOne: {
          filter: { vendorId: vendor.id, posItemId: it.posItemId },
          update: {
            $set: { ...it, sortOrder, syncedAt: now },
            $setOnInsert: { id: prior?.id ?? newId("itm") },
          },
          upsert: true,
        },
      };
    });
    if (ops.length) await c.menuItems.bulkWrite(ops, { ordered: false });
    const removed = existing.filter((i) => !seen.has(i.posItemId)).map((i) => i.id);
    if (removed.length) await c.menuItems.deleteMany({ id: { $in: removed } });
    return { vendorId: vendor.id, ok: true, itemCount: menu.items.length, source: menu.source, error: null, durationMs: Date.now() - t0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ vendorId: vendor.id, err: msg }, "menu sync failed");
    return {
      vendorId: vendor.id,
      ok: false,
      itemCount: 0,
      source: vendor.posMode === "tablet" ? "seed" : "pos",
      error: msg,
      durationMs: Date.now() - t0,
    };
  }
}
