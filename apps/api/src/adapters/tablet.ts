/**
 * TabletAdapter — vendors with no POS. Menu comes from seed templates; orders live only in api
 * and show on the vendor panel (KDS).
 */
import { STARTER_TABLET_MENU, TABLET_MENUS } from "@one/db";
import type { PosAdapter } from "./types";

export const tabletAdapter: PosAdapter = {
  async getMenu(vendor) {
    const template = TABLET_MENUS[vendor.slug] ?? STARTER_TABLET_MENU;
    return {
      source: "seed",
      items: template.map((t) => ({ ...t, available: true, imageUrl: null })),
    };
  },
  async submitOrder() {
    return { posOrderId: null };
  },
  async updatePaymentStatus() {
    /* no POS to tell */
  },
  async closeOrder() {
    /* no POS to tell */
  },
};
