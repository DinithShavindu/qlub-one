"use client";
import { useMutation } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { apiFetch, useToast } from "@one/ui";
import { AppButton } from "@/components/AppButton";
import { usePanel } from "@/lib/panel";
import { PickVendorHint } from "./ui";

/**
 * "Sync … from POS" for the vendor the page is scoped to. Disabled (with the reason) for a manager
 * on "All vendors" or for a tablet vendor, which has no POS to pull from.
 */
export function PosSyncButton<T>({
  path,
  label,
  what,
  onDone,
}: {
  path: string;
  label: string;
  /** "sync its menu" — completes "Pick a vendor … to …". */
  what: string;
  onDone: (res: T) => string;
}) {
  const { vendor, isManager } = usePanel();
  const { toast } = useToast();
  const sync = useMutation({
    mutationFn: () => apiFetch<T>(path, { method: "POST", json: isManager && vendor ? { vendorId: vendor.id } : {} }),
    onSuccess: (res) => toast({ title: onDone(res), variant: "success" }),
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Sync failed", variant: "error" }),
  });
  if (!vendor) return <PickVendorHint what={what} />;
  const tablet = vendor.posMode !== "mock_pos";
  return (
    <div className="flex items-center gap-3">
      {tablet && <span className="text-small text-ink-muted">{vendor.name} uses a tablet — no POS to sync from.</span>}
      <AppButton size="lg" variant="secondary" disabled={tablet} loading={sync.isPending} onClick={() => sync.mutate()}>
        <RefreshCw className="h-4 w-4" aria-hidden />
        {label}
      </AppButton>
    </div>
  );
}
