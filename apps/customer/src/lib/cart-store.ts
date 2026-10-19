"use client";
import { useEffect, useState } from "react";
import { create, useStore, type StoreApi, type UseBoundStore } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartLine } from "@one/contracts";

/** A cart line plus cached display data so the cart renders before the server quote arrives. */
export interface StoredLine {
  /** menuItemId + trimmed note — the server merges on the same pair. */
  key: string;
  menuItemId: string;
  qty: number;
  note?: string;
  name: string;
  priceMinor: number;
  vendorId: string;
}

export interface CartState {
  tableId: string | null;
  tableLabel: string | null;
  lines: StoredLine[];
  /** Banner to show on the cart page (e.g. after checkout found a sold-out item). */
  notice: string[] | null;
  setTable: (tableId: string, tableLabel: string | null) => void;
  add: (line: Omit<StoredLine, "key" | "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  removeItems: (menuItemIds: string[]) => void;
  updateCached: (menuItemId: string, patch: { name?: string; priceMinor?: number }) => void;
  setNotice: (notice: string[] | null) => void;
  clear: () => void;
}

export const MAX_QTY = 50;

export function lineKey(menuItemId: string, note?: string | null): string {
  return `${menuItemId}::${note?.trim() ?? ""}`;
}

type CartStore = UseBoundStore<StoreApi<CartState>> & {
  persist: {
    rehydrate: () => Promise<void> | void;
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
};

const stores = new Map<string, CartStore>();

export function getCartStore(venueId: string): CartStore {
  let s = stores.get(venueId);
  if (s) return s;
  s = create<CartState>()(
    persist(
      (set) => ({
        tableId: null,
        tableLabel: null,
        lines: [],
        notice: null,
        setTable: (tableId, tableLabel) =>
          set((st) => ({ tableId, tableLabel: tableLabel ?? (st.tableId === tableId ? st.tableLabel : null) })),
        add: (line, qty = 1) =>
          set((st) => {
            const note = line.note?.trim() || undefined;
            const key = lineKey(line.menuItemId, note);
            const existing = st.lines.find((l) => l.key === key);
            if (existing) {
              return {
                lines: st.lines.map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l)),
              };
            }
            return { lines: [...st.lines, { ...line, note, key, qty: Math.min(MAX_QTY, qty) }] };
          }),
        setQty: (key, qty) =>
          set((st) => ({
            lines:
              qty <= 0
                ? st.lines.filter((l) => l.key !== key)
                : st.lines.map((l) => (l.key === key ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)),
          })),
        remove: (key) => set((st) => ({ lines: st.lines.filter((l) => l.key !== key) })),
        removeItems: (ids) => set((st) => ({ lines: st.lines.filter((l) => !ids.includes(l.menuItemId)) })),
        updateCached: (menuItemId, patch) =>
          set((st) => ({ lines: st.lines.map((l) => (l.menuItemId === menuItemId ? { ...l, ...patch } : l)) })),
        setNotice: (notice) => set({ notice }),
        clear: () => set({ lines: [], notice: null }),
      }),
      {
        name: `cart:${venueId}`,
        storage: createJSONStorage(() => sessionStorage),
        skipHydration: true,
        partialize: (st) => ({ tableId: st.tableId, tableLabel: st.tableLabel, lines: st.lines, notice: st.notice }),
      },
    ),
  ) as CartStore;
  stores.set(venueId, s);
  return s;
}

export function useCart<T>(venueId: string, selector: (s: CartState) => T): T {
  return useStore(getCartStore(venueId), selector);
}

/** sessionStorage only exists in the browser: rehydrate after mount to avoid SSR mismatches. */
export function useCartHydrated(venueId: string): boolean {
  const store = getCartStore(venueId);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (store.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = store.persist.onFinishHydration(() => setHydrated(true));
    void store.persist.rehydrate();
    return unsub;
  }, [store]);
  return hydrated;
}

export function toCartLines(lines: StoredLine[]): CartLine[] {
  return lines.map((l) => ({ menuItemId: l.menuItemId, qty: l.qty, ...(l.note ? { note: l.note } : {}) }));
}

export function cartSignature(lines: StoredLine[]): string {
  return lines.map((l) => `${l.key}x${l.qty}`).join("|");
}
