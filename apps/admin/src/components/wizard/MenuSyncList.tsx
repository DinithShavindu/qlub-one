"use client";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button, VendorBadge, apiFetch } from "@one/ui";
import type { AdminVenueDetailResponse, MenuSyncResponse, MenuSyncResult } from "@one/contracts";
import { errorMessage, qk } from "@/lib/queries";
import { plural } from "@/lib/format";

export type SyncRow = { state: "syncing" } | { state: "done"; result: MenuSyncResult };
export type SyncState = Record<string, SyncRow>;

export function MenuSyncList({
  detail,
  sync,
  setSync,
  onBack,
  onNext,
}: {
  detail: AdminVenueDetailResponse;
  sync: SyncState;
  setSync: (fn: (s: SyncState) => SyncState) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const qc = useQueryClient();
  const venueId = detail.venue.id;
  const vendors = detail.vendors;

  async function syncOne(vendorId: string) {
    setSync((s) => ({ ...s, [vendorId]: { state: "syncing" } }));
    let result: MenuSyncResult;
    try {
      const res = await apiFetch<MenuSyncResponse>(`/v1/admin/venues/${venueId}/menus/sync`, { method: "POST", json: { vendorIds: [vendorId] } });
      result = res.results[0] ?? { vendorId, ok: false, itemCount: 0, source: "pos", error: "No result returned", durationMs: 0 };
    } catch (e) {
      result = { vendorId, ok: false, itemCount: 0, source: "pos", error: errorMessage(e), durationMs: 0 };
    }
    setSync((s) => ({ ...s, [vendorId]: { state: "done", result } }));
    if (result.ok) {
      // keep the cached venue counts in step with what we just synced
      qc.setQueryData<AdminVenueDetailResponse>(qk.venue(venueId), (prev) => {
        if (!prev) return prev;
        const vendors = prev.vendors.map((v) => (v.id === vendorId ? { ...v, itemCount: result.itemCount } : v));
        return { ...prev, vendors, itemCount: vendors.reduce((a, v) => a + v.itemCount, 0) };
      });
    }
  }

  async function syncAll() {
    // one request per vendor so each row updates the moment its POS answers
    await Promise.all(vendors.map((v) => syncOne(v.id)));
    void qc.invalidateQueries({ queryKey: qk.venue(venueId) });
    void qc.invalidateQueries({ queryKey: qk.venues });
  }

  async function retry(vendorId: string) {
    await syncOne(vendorId);
    void qc.invalidateQueries({ queryKey: qk.venue(venueId) });
  }

  // derive per-vendor status; fall back to server item counts (e.g. after Back / reload)
  const rows = vendors.map((v) => {
    const r = sync[v.id];
    if (r?.state === "syncing") return { v, status: "syncing" as const, items: 0, error: null, source: null, ms: 0 };
    if (r?.state === "done")
      return r.result.ok
        ? { v, status: "ok" as const, items: r.result.itemCount, error: null, source: r.result.source, ms: r.result.durationMs }
        : { v, status: "failed" as const, items: 0, error: r.result.error, source: null, ms: r.result.durationMs };
    if (v.itemCount > 0) return { v, status: "ok" as const, items: v.itemCount, error: null, source: v.posMode === "tablet" ? ("seed" as const) : ("pos" as const), ms: 0 };
    return { v, status: "idle" as const, items: 0, error: null, source: null, ms: 0 };
  });
  const syncing = rows.some((r) => r.status === "syncing");
  const okCount = rows.filter((r) => r.status === "ok").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const idle = rows.filter((r) => r.status === "idle").length;
  const items = rows.reduce((a, r) => a + r.items, 0);
  const anyStarted = rows.some((r) => r.status !== "idle");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface px-5 py-4">
        <div>
          <p className="font-display text-h2 font-bold">Pull every menu at once</p>
          <p className="text-small text-ink-soft">POS vendors sync from their POS; tablet vendors start from a seed menu.</p>
        </div>
        <Button size="lg" onClick={() => void syncAll()} loading={syncing} disabled={!vendors.length}>
          <RefreshCw className="h-4 w-4" aria-hidden /> {anyStarted ? "Sync all again" : "Sync all menus"}
        </Button>
      </div>

      <ul className="divide-y divide-line rounded-lg border border-line bg-surface" aria-live="polite">
        {rows.map(({ v, status, items: n, error, source, ms }) => (
          <li key={v.id} className="flex items-center gap-4 px-5 py-3">
            <VendorBadge vendor={v} className="w-56" />
            <span className="w-52 shrink-0 text-small text-ink-muted">{v.posMode === "mock_pos" ? `Mock POS · ${v.posVendorId}` : "Tablet"}</span>
            <span className="flex flex-1 items-center gap-2 text-small font-semibold">
              {status === "idle" && <span className="text-ink-muted">Not synced yet</span>}
              {status === "syncing" && (
                <span className="inline-flex items-center gap-2 text-ink-soft">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Syncing…
                </span>
              )}
              {status === "ok" && (
                <span className="inline-flex items-center gap-2 text-vendor-3">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> {plural(n, "item")}
                  {source === "seed" && <span className="font-normal text-ink-muted">· Menu from seed</span>}
                  {ms > 0 && <span className="font-normal text-ink-muted">· {(ms / 1000).toFixed(1)}s</span>}
                </span>
              )}
              {status === "failed" && (
                <span className="inline-flex items-center gap-2 text-status-failed-fg">
                  <AlertTriangle className="h-4 w-4" aria-hidden /> failed: &ldquo;{error}&rdquo;
                </span>
              )}
            </span>
            {status === "failed" && (
              <Button variant="secondary" size="sm" onClick={() => void retry(v.id)}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Retry
              </Button>
            )}
          </li>
        ))}
      </ul>

      <p className="font-display text-body font-bold tabular-nums" role="status">
        {plural(okCount, "vendor")} synced · {plural(items, "item")} · {plural(failed, "error")}
        {idle > 0 && <span className="font-sans font-normal text-ink-muted"> · {idle} not synced yet</span>}
      </p>

      {!syncing && (failed > 0 || (anyStarted && idle > 0)) && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-status-prep px-4 py-3 text-small font-semibold text-status-prep-fg">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {plural(failed + idle, "vendor")} without a menu — guests won&apos;t see {failed + idle === 1 ? "it" : "them"} until you retry. You can continue and fix it later.
        </p>
      )}

      <div className="flex items-center justify-between border-t border-line pt-6">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <Button size="lg" variant={failed + idle > 0 ? "secondary" : "primary"} disabled={syncing || okCount === 0} onClick={onNext}>
          {failed + idle > 0 ? "Continue anyway" : "Continue to tables"} <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
