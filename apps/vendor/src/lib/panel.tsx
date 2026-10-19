"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Vendor, VendorMeResponse } from "@one/contracts";
import { readStorage, STORAGE_KEYS, writeStorage } from "./storage";

interface Panel {
  me: VendorMeResponse;
  isManager: boolean;
  /** Manager's vendor filter: "" = all vendors. Always the vendor's own id for a vendor session. */
  vendorId: string;
  setVendorId: (id: string) => void;
  /** The one vendor the page acts on, or null when a manager is looking at all vendors. */
  vendor: Vendor | null;
  vendorsById: Map<string, Vendor>;
  /** Appends `vendorId=` for a manager's filter (the API ignores it for a vendor session). */
  scoped: (path: string) => string;
}

const Ctx = createContext<Panel | null>(null);

export function PanelProvider({ me, children }: { me: VendorMeResponse; children: ReactNode }) {
  const isManager = me.role === "manager";
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!isManager) return;
    const saved = readStorage(STORAGE_KEYS.vendorFilter) ?? "";
    setFilter(me.vendors.some((v) => v.id === saved) ? saved : "");
  }, [isManager, me.vendors]);

  const setVendorId = useCallback((id: string) => {
    setFilter(id);
    writeStorage(STORAGE_KEYS.vendorFilter, id);
  }, []);

  const value = useMemo<Panel>(() => {
    const vendorsById = new Map(me.vendors.map((v) => [v.id, v]));
    const vendorId = isManager ? filter : me.vendor!.id;
    const vendor = vendorId ? vendorsById.get(vendorId) ?? null : null;
    const scoped = (path: string) => (isManager && filter ? `${path}${path.includes("?") ? "&" : "?"}vendorId=${encodeURIComponent(filter)}` : path);
    return { me, isManager, vendorId, setVendorId, vendor, vendorsById, scoped };
  }, [me, isManager, filter, setVendorId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePanel(): Panel {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePanel must be used inside <PanelProvider>");
  return ctx;
}
