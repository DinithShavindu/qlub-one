"use client";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, apiFetch } from "@one/ui";
import type { AdminVenueDetailResponse, BulkVendorsResponse, MenuSyncResponse, PosMode, TablesResponse } from "@one/contracts";
import { Modal } from "@/components/Modal";
import type { PinRow } from "@/components/wizard/PinRevealModal";
import { errorMessage, qk, usePosVendors } from "@/lib/queries";

const input = "h-11 w-full rounded-lg border border-line bg-surface px-3 text-body";
const labelCls = "mb-1 block text-small font-semibold";

export interface AddVendorResult {
  pins: PinRow[];
  itemCount: number;
  qrCount: number;
  menuError: string | null;
}

/**
 * Adds one vendor to an existing venue: create → sync its menu → optionally its own QRs.
 * The PIN comes back in `onCreated` so the caller can show it once.
 */
export function AddVendorModal({
  open,
  onClose,
  detail,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  detail: AdminVenueDetailResponse;
  onCreated: (res: AddVendorResult) => void;
}) {
  const venueId = detail.venue.id;
  const qc = useQueryClient();
  const pos = usePosVendors();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍽️");
  const pat = detail.venue.flow === "pat";
  const [mode, setMode] = useState<PosMode>(pat ? "mock_pos" : "tablet");
  const [posVendorId, setPosVendorId] = useState("");
  const [qrs, setQrs] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const usedPos = new Set(detail.vendors.map((v) => v.posVendorId).filter(Boolean));
  const available = (pos.data?.vendors ?? []).filter((p) => !usedPos.has(p.posVendorId));

  function reset() {
    setName("");
    setEmoji("🍽️");
    setMode(pat ? "mock_pos" : "tablet");
    setPosVendorId("");
    setQrs("0");
    setError(null);
  }

  const create = useMutation({
    mutationFn: async (): Promise<AddVendorResult> => {
      const created = await apiFetch<BulkVendorsResponse>(`/v1/admin/venues/${venueId}/vendors/bulk`, {
        method: "POST",
        json: { vendors: [{ name: name.trim(), emoji: emoji.trim() || "🍽️", posMode: mode, ...(mode === "mock_pos" ? { posVendorId } : {}) }] },
      });
      const vendor = created.vendors[0]!;
      // the vendor exists from here on — later failures are reported, not thrown
      let itemCount = 0;
      let menuError: string | null = null;
      try {
        const sync = await apiFetch<MenuSyncResponse>(`/v1/admin/venues/${venueId}/menus/sync`, { method: "POST", json: { vendorIds: [vendor.id] } });
        itemCount = sync.totalItems;
        menuError = sync.results[0]?.error ?? null;
      } catch (err) {
        menuError = errorMessage(err);
      }
      let qrCount = 0;
      const n = Number(qrs);
      if (Number.isInteger(n) && n > 0) {
        try {
          await apiFetch<TablesResponse>(`/v1/admin/venues/${venueId}/tables`, {
            method: "POST",
            json: { count: n, prefix: vendor.letter, vendorId: vendor.id },
          });
          qrCount = n;
        } catch (err) {
          menuError = [menuError, `QRs not created: ${errorMessage(err)}`].filter(Boolean).join(" · ");
        }
      }
      return { pins: created.pins, itemCount, qrCount, menuError };
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: qk.venue(venueId) });
      void qc.invalidateQueries({ queryKey: qk.tables(venueId) });
      void qc.invalidateQueries({ queryKey: qk.venues });
      void qc.invalidateQueries({ queryKey: ["qr-list"] });
      reset();
      onCreated(res);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 40) return setError("Name must be 1–40 characters.");
    if (detail.vendors.some((v) => v.name.toLowerCase() === trimmed.toLowerCase())) return setError(`"${trimmed}" already exists in this venue.`);
    if (mode === "mock_pos" && !posVendorId) return setError("Pick the POS vendor this stall uses.");
    const n = Number(qrs);
    if (!Number.isInteger(n) || n < 0 || n > 200) return setError("Vendor QRs must be 0–200.");
    setError(null);
    create.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (create.isPending) return;
        reset();
        onClose();
      }}
      title={`Add a vendor to ${detail.venue.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="add-vendor" loading={create.isPending}>
            Add vendor
          </Button>
        </>
      }
    >
      <form id="add-vendor" onSubmit={submit} noValidate className="grid gap-4">
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <div>
            <label htmlFor="vendor-name" className={labelCls}>
              Vendor name
            </label>
            <input id="vendor-name" autoFocus className={input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Noodle Bar" />
          </div>
          <div>
            <label htmlFor="vendor-emoji" className={labelCls}>
              Emoji
            </label>
            <input id="vendor-emoji" className={`${input} text-center`} value={emoji} maxLength={8} onChange={(e) => setEmoji(e.target.value)} />
          </div>
        </div>

        <div>
          <label htmlFor="vendor-mode" className={labelCls}>
            Orders go to
          </label>
          <select
            id="vendor-mode"
            className={input}
            value={mode}
            onChange={(e) => setMode(e.target.value as PosMode)}
          >
            {!pat && <option value="tablet">Tablet (kitchen display) — starter menu</option>}
            <option value="mock_pos">POS — menu synced from the POS</option>
          </select>
        </div>

        {mode === "mock_pos" && (
          <div>
            <label htmlFor="vendor-pos" className={labelCls}>
              POS vendor
            </label>
            <select
              id="vendor-pos"
              className={input}
              value={posVendorId}
              onChange={(e) => {
                setPosVendorId(e.target.value);
                const p = available.find((x) => x.posVendorId === e.target.value);
                if (p && !name.trim()) {
                  setName(p.displayName);
                  setEmoji(p.emoji);
                }
              }}
            >
              <option value="">{pos.isPending ? "Loading POS directory…" : available.length ? "Choose…" : "No unused POS vendors"}</option>
              {available.map((p) => (
                <option key={p.posVendorId} value={p.posVendorId}>
                  {p.emoji} {p.displayName} ({p.posVendorId})
                </option>
              ))}
            </select>
            {pos.isError && <p className="mt-1 text-small text-status-failed-fg">Couldn&apos;t reach the POS directory: {errorMessage(pos.error)}</p>}
          </div>
        )}

        <div>
          <label htmlFor="vendor-qrs" className={labelCls}>
            Vendor QRs
          </label>
          <input id="vendor-qrs" inputMode="numeric" className={`${input} w-28`} value={qrs} onChange={(e) => setQrs(e.target.value)} />
          <p className="mt-1 text-small text-ink-muted">QRs that open only this vendor. 0 = none; the venue&apos;s shared QRs already include every vendor.</p>
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-status-failed px-4 py-3 text-small font-semibold text-status-failed-fg">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
