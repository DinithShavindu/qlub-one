"use client";
import { Store } from "lucide-react";
import { EmptyState, ErrorState, Skeleton } from "@one/ui";
import type { PosVendor } from "@one/contracts";

export function VendorPicker({
  available,
  loading,
  error,
  onRetry,
  picked,
  onChange,
}: {
  available: PosVendor[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  picked: string[];
  onChange: (posVendorIds: string[]) => void;
}) {
  const allPicked = available.length > 0 && available.every((v) => picked.includes(v.posVendorId));
  return (
    <div className="flex h-full flex-col rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="font-display text-body font-bold">Pick from POS</h3>
        {available.length > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-small font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={allPicked}
              onChange={() => onChange(allPicked ? [] : available.map((v) => v.posVendorId))}
            />
            Select all
          </label>
        )}
      </div>
      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Couldn't reach the POS directory" body={`${error} You can still paste tablet vendors.`} retry={onRetry} className="py-6" />
      ) : available.length === 0 ? (
        <EmptyState icon={<Store className="h-6 w-6" />} title="All POS vendors added" body="Every vendor in the POS directory is already in this venue." className="py-6" />
      ) : (
        <ul className="divide-y divide-line">
          {available.map((v) => {
            const checked = picked.includes(v.posVendorId);
            return (
              <li key={v.posVendorId}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-paper">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={checked}
                    onChange={() => onChange(checked ? picked.filter((p) => p !== v.posVendorId) : [...picked, v.posVendorId])}
                  />
                  <span className="text-xl" aria-hidden>
                    {v.emoji}
                  </span>
                  <span className="flex-1 font-semibold">{v.displayName}</span>
                  <span className="font-mono text-micro text-ink-muted">{v.posVendorId}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
