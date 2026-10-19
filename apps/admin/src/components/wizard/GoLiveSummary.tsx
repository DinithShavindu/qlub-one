"use client";
import { cx } from "@/lib/cx";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, LayoutDashboard, Rocket, XCircle } from "lucide-react";
import { Button, StatTile, apiFetch, formatDuration } from "@one/ui";
import type { AdminVenueDetailResponse, GoLiveResponse } from "@one/contracts";
import { ButtonLink } from "@/components/ButtonLink";
import { FLOW_SHORT, GATEWAY_LABEL, VENUE_TYPE_LABEL, baselineLine, feePct, plural } from "@/lib/format";
import { errorMessage, qk, useTables } from "@/lib/queries";

function CheckRow({ ok, warn, children }: { ok: boolean; warn?: boolean; children: ReactNode }) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <Icon className={cx("h-5 w-5 shrink-0", ok ? "text-vendor-3" : warn ? "text-status-prep-fg" : "text-status-failed-fg")} aria-hidden />
      <span className="sr-only">{ok ? "Done:" : warn ? "Warning:" : "Missing:"}</span>
      <span className="text-body">{children}</span>
    </li>
  );
}

export function GoLiveSummary({ detail, onBack }: { detail: AdminVenueDetailResponse; onBack: () => void }) {
  const venueId = detail.venue.id;
  const qc = useQueryClient();
  const tables = useTables(venueId);
  const [result, setResult] = useState<GoLiveResponse | null>(null);

  // make sure the checklist reflects the latest server counts
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: qk.venue(venueId) });
  }, [qc, venueId]);

  const goLive = useMutation({
    mutationFn: () => apiFetch<GoLiveResponse>(`/v1/admin/venues/${venueId}/go-live`, { method: "POST" }),
    onSuccess: (res) => {
      setResult(res);
      void qc.invalidateQueries({ queryKey: qk.venue(venueId) });
      void qc.invalidateQueries({ queryKey: qk.venues });
    },
  });

  const { venue, vendors, itemCount, tableCount } = detail;
  const live = result ?? (venue.status === "live" ? { setupDurationMs: venue.setupDurationMs ?? 0, baselineMinPerVendor: detail.baselineMinPerVendor, vendorCount: vendors.length } : null);

  if (live) {
    const t1 = tables.data?.tables[0];
    return (
      <div className="flex flex-col items-center gap-6 py-6 text-center">
        <p className="inline-flex items-center gap-2 rounded-md bg-status-ready px-3 py-1.5 text-small font-semibold text-status-ready-fg">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> {venue.name} is live
        </p>
        <StatTile
          emphasis
          className="w-full max-w-xl py-8 [&>p:nth-child(2)]:text-[64px] [&>p:nth-child(2)]:leading-[72px]"
          label="One setup for the whole venue"
          value={`Set up in ${formatDuration(live.setupDurationMs)}`}
          delta={baselineLine(live.vendorCount, live.baselineMinPerVendor)}
          hint={`${plural(live.vendorCount, "vendor")} · ${plural(itemCount, "menu item")} · ${plural(tableCount, "QR code")}`}
        />
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href={`/venues/${venueId}`} size="lg">
            <LayoutDashboard className="h-4 w-4" aria-hidden /> Open venue dashboard
          </ButtonLink>
          {t1 ? (
            <ButtonLink href={t1.url} external variant="secondary" size="lg">
              <ExternalLink className="h-4 w-4" aria-hidden /> Open guest view ({t1.label})
            </ButtonLink>
          ) : (
            <Button variant="secondary" size="lg" disabled>
              {tables.isError ? "Guest view unavailable" : "Loading guest link…"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const emptyMenus = vendors.filter((v) => v.itemCount === 0);
  const closed = vendors.filter((v) => !v.isOpen);
  const blocking = !vendors.length || !itemCount || !tableCount;

  return (
    <div className="flex flex-col gap-6">
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        <CheckRow ok>
          Venue <strong>{venue.name}</strong> · {VENUE_TYPE_LABEL[venue.type]} · {FLOW_SHORT[venue.flow]} · {GATEWAY_LABEL[venue.gateway]} · {venue.currency} · qlub commission {feePct(venue.feeBps)}
        </CheckRow>
        <CheckRow ok={vendors.length > 0}>{plural(vendors.length, "vendor")}</CheckRow>
        <CheckRow ok={itemCount > 0}>{plural(itemCount, "menu item")}</CheckRow>
        <CheckRow ok={tableCount > 0}>{plural(tableCount, "QR code")}</CheckRow>
        {emptyMenus.map((v) => (
          <CheckRow key={v.id} ok={false} warn>
            {v.emoji} {v.name} has no menu yet — guests won&apos;t see it. Go back to Menus to retry.
          </CheckRow>
        ))}
        {emptyMenus.length === 0 && closed.length === 0 && <CheckRow ok>No warnings</CheckRow>}
        {closed.map((v) => (
          <CheckRow key={v.id} ok={false} warn>
            {v.emoji} {v.name} is closed and won&apos;t take orders.
          </CheckRow>
        ))}
      </ul>

      {goLive.isError && (
        <p role="alert" className="rounded-md bg-status-failed px-4 py-3 text-small font-semibold text-status-failed-fg">
          Couldn&apos;t go live: {errorMessage(goLive.error)}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-line pt-6">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <div className="flex items-center gap-3">
          {blocking && <span className="text-small text-status-failed-fg">Add vendors, menu items and tables first</span>}
          <Button size="xl" disabled={blocking} loading={goLive.isPending} onClick={() => goLive.mutate()}>
            <Rocket className="h-5 w-5" aria-hidden /> Go live
          </Button>
        </div>
      </div>
    </div>
  );
}
