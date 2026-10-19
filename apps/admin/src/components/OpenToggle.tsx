"use client";
import { cx } from "@/lib/cx";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, useToast } from "@one/ui";
import type { Vendor } from "@one/contracts";
import { errorMessage } from "@/lib/queries";

/** Open / Closed switch for a vendor. Label text always shown (status is text first). */
export function OpenToggle({ vendor, venueId }: { vendor: Pick<Vendor, "id" | "name" | "isOpen">; venueId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  // last confirmed value until the refetched prop catches up — avoids double-click races
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  useEffect(() => setConfirmed(null), [vendor.isOpen]);
  const m = useMutation({
    mutationFn: (isOpen: boolean) => apiFetch<Vendor>(`/v1/admin/vendors/${vendor.id}/open`, { method: "POST", json: { isOpen } }),
    onSuccess: (v) => {
      setConfirmed(v.isOpen);
      toast({ title: `${v.name} is now ${v.isOpen ? "open" : "closed"}`, variant: "success" });
      void qc.invalidateQueries({ queryKey: ["venue", venueId] });
      void qc.invalidateQueries({ queryKey: ["dashboard", venueId] });
    },
    onError: (e) => toast({ title: `Couldn't update ${vendor.name}: ${errorMessage(e)}`, variant: "error" }),
  });
  const isOpen = m.isPending ? !!m.variables : confirmed ?? vendor.isOpen;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOpen}
      aria-label={`${vendor.name} open for orders`}
      disabled={m.isPending}
      onClick={() => m.mutate(!isOpen)}
      className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-small font-semibold disabled:opacity-60"
    >
      <span className={cx("relative h-6 w-11 rounded-full transition", isOpen ? "bg-vendor-3" : "bg-line")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-card transition", isOpen ? "left-[22px]" : "left-0.5")} />
      </span>
      <span className={isOpen ? "text-ink" : "text-ink-muted"}>{isOpen ? "Open" : "Closed"}</span>
    </button>
  );
}
