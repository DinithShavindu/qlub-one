"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button, ErrorState, Skeleton, VendorBadge, apiFetch, useToast } from "@one/ui";
import {
  MULTIVENDOR_TYPES,
  OrderFlow,
  PaymentGateway,
  isMultivendor,
  type AdminVendor,
  type AdminVenueDetailResponse,
  type MenuSyncResponse,
  type PosMode,
  type UpdateVendorRequest,
  type UpdateVenueRequest,
  type VenueType,
} from "@one/contracts";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { DraftBanner } from "@/components/venue/DraftBanner";
import { FLOW_HINT, FLOW_LABEL, GATEWAY_LABEL, VENUE_TYPE_LABEL, feePct, parseFeePct } from "@/lib/format";
import { errorMessage, qk, usePosVendors, useVenue } from "@/lib/queries";

const input = "h-11 w-full rounded-md border border-line bg-surface px-3 text-body disabled:bg-surface-sunk disabled:text-ink-soft";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-small font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-small text-ink-muted">{hint}</p>}
    </div>
  );
}

function Section({ title, onSubmit, saving, error, children }: { title: string; onSubmit?: (e: FormEvent) => void; saving?: boolean; error?: string | null; children: ReactNode }) {
  return (
    <Card title={title}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 p-6">
        {children}
        {error && (
          <p role="alert" className="rounded-md bg-status-failed px-4 py-3 text-small font-semibold text-status-failed-fg">
            {error}
          </p>
        )}
        {onSubmit && (
          <div>
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

/** Saves venue fields and refreshes everything that shows them. */
function useSaveVenue(venueId: string, label: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (req: UpdateVenueRequest) => apiFetch(`/v1/admin/venues/${venueId}`, { method: "PATCH", json: req }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.venue(venueId) });
      void qc.invalidateQueries({ queryKey: qk.venues });
      toast({ title: `${label} saved`, variant: "success" });
    },
  });
}

function useSaveVendor(venueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ vendorId, req }: { vendorId: string; req: UpdateVendorRequest }) => apiFetch(`/v1/admin/vendors/${vendorId}`, { method: "PATCH", json: req }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.venue(venueId) });
      void qc.invalidateQueries({ queryKey: qk.venues });
    },
  });
}

function GeneralSection({ d }: { d: AdminVenueDetailResponse }) {
  const v = d.venue;
  const [name, setName] = useState(v.name);
  const [type, setType] = useState<VenueType>(v.type);
  const save = useSaveVenue(v.id, "General");
  const single = v.type === "restaurant";
  return (
    <Section
      title="General"
      saving={save.isPending}
      error={save.isError ? errorMessage(save.error) : null}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ name: name.trim(), type });
      }}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="s-name" label={single ? "Restaurant name" : "Venue name"}>
          <input id="s-name" className={input} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="s-code" label="Venue code" hint="Vendors type this on the kitchen display login.">
          <input id="s-code" className={`${input} font-mono`} value={v.code} disabled />
        </Field>
        <Field
          id="s-type"
          label="Venue type"
          hint={single ? "Single venue. To group several restaurants, onboard a food court or hotel." : "Multivendor venue — a set of restaurants working together."}
        >
          {single ? (
            <input id="s-type" className={input} value={VENUE_TYPE_LABEL.restaurant} disabled />
          ) : (
            <select id="s-type" className={input} value={type} onChange={(e) => setType(e.target.value as VenueType)}>
              {MULTIVENDOR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {VENUE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
    </Section>
  );
}

function PaymentSection({ d }: { d: AdminVenueDetailResponse }) {
  const v = d.venue;
  const [gateway, setGateway] = useState<PaymentGateway>(v.gateway);
  const [merchantId, setMerchantId] = useState(v.gatewayMerchantId ?? "");
  const [fee, setFee] = useState((v.feeBps / 100).toFixed(v.feeBps % 100 ? 2 : 1));
  const [err, setErr] = useState<string | null>(null);
  const save = useSaveVenue(v.id, "Payment settings");
  return (
    <Section
      title="Payment gateway & commission"
      saving={save.isPending}
      error={err ?? (save.isError ? errorMessage(save.error) : null)}
      onSubmit={(e) => {
        e.preventDefault();
        const feeBps = parseFeePct(fee);
        if (feeBps === null) return setErr("Commission must be 0–20%, up to 2 decimals.");
        setErr(null);
        save.mutate({ gateway, gatewayMerchantId: merchantId.trim() || null, feeBps });
      }}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="s-gateway" label="Payment gateway" hint="Every gateway is simulated in this build; the payment reference shows which one captured.">
          <select id="s-gateway" className={input} value={gateway} onChange={(e) => setGateway(e.target.value as PaymentGateway)}>
            {PaymentGateway.options.map((g) => (
              <option key={g} value={g}>
                {GATEWAY_LABEL[g]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="s-merchant" label="Gateway merchant id">
          <input id="s-merchant" className={input} value={merchantId} maxLength={60} onChange={(e) => setMerchantId(e.target.value)} placeholder="Optional" />
        </Field>
        <Field id="s-fee" label="qlub commission %" hint={isMultivendor(v.type) ? "Default for every vendor; override per vendor below." : "Taken from every order."}>
          <input id="s-fee" inputMode="decimal" className={`${input} w-28`} value={fee} onChange={(e) => setFee(e.target.value)} />
        </Field>
      </div>
    </Section>
  );
}

function VendorFeeRow({ vendor, venueFeeBps, venueId }: { vendor: AdminVendor; venueFeeBps: number; venueId: string }) {
  const { toast } = useToast();
  const [fee, setFee] = useState(vendor.feeBps === null ? "" : (vendor.feeBps / 100).toFixed(vendor.feeBps % 100 ? 2 : 1));
  const [err, setErr] = useState<string | null>(null);
  const save = useSaveVendor(venueId);
  const current = vendor.feeBps === null ? "" : (vendor.feeBps / 100).toFixed(vendor.feeBps % 100 ? 2 : 1);
  return (
    <tr>
      <td>
        <VendorBadge vendor={vendor} />
      </td>
      <td className="text-ink-soft">{vendor.feeBps === null ? `${feePct(venueFeeBps)} (venue default)` : feePct(vendor.feeBps)}</td>
      <td>
        <input
          inputMode="decimal"
          aria-label={`Commission override for ${vendor.name}`}
          className="h-10 w-24 rounded-md border border-line bg-surface px-3"
          value={fee}
          placeholder="default"
          onChange={(e) => setFee(e.target.value)}
        />
        {err && <p className="mt-1 text-small text-status-failed-fg">{err}</p>}
      </td>
      <td className="text-right">
        <Button
          size="sm"
          variant="secondary"
          disabled={fee === current}
          loading={save.isPending}
          onClick={() => {
            const feeBps = fee.trim() === "" ? null : parseFeePct(fee);
            if (fee.trim() !== "" && feeBps === null) return setErr("0–20%, up to 2 decimals");
            setErr(null);
            save.mutate(
              { vendorId: vendor.id, req: { feeBps } },
              {
                onSuccess: () => toast({ title: `${vendor.name}: ${feeBps === null ? "uses venue commission" : `commission ${feePct(feeBps)}`}`, variant: "success" }),
                onError: (e) => setErr(errorMessage(e)),
              },
            );
          }}
        >
          Save
        </Button>
      </td>
    </tr>
  );
}

function VendorCommissionSection({ d }: { d: AdminVenueDetailResponse }) {
  return (
    <Card title="Commission per vendor">
      <p className="px-6 pt-4 text-small text-ink-soft">Leave blank to use the venue commission. Applies to new orders only.</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Commission now</th>
            <th>Override %</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {d.vendors.map((vd) => (
            <VendorFeeRow key={`${vd.id}:${vd.feeBps}`} vendor={vd} venueFeeBps={d.venue.feeBps} venueId={d.venue.id} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function FlowSection({ d }: { d: AdminVenueDetailResponse }) {
  const v = d.venue;
  const [flow, setFlow] = useState<OrderFlow>(v.flow);
  const save = useSaveVenue(v.id, "Flow");
  const tablet = d.vendors.filter((x) => x.posMode !== "mock_pos");
  return (
    <Section
      title="Flow setup"
      saving={save.isPending}
      error={save.isError ? errorMessage(save.error) : null}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ flow });
      }}
    >
      <p className="text-small text-ink-soft">One mode per venue{isMultivendor(v.type) ? " — every vendor here follows it" : ""}.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {OrderFlow.options.map((f) => {
          const blocked = f === "pat" && tablet.length > 0;
          return (
            <label
              key={f}
              className={`flex gap-3 rounded-xl border p-4 transition ${flow === f ? "border-brand bg-status-new/40" : "border-line"} ${blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            >
              <input type="radio" name="flow" className="mt-1 accent-brand" checked={flow === f} disabled={blocked} onChange={() => setFlow(f)} />
              <span>
                <span className="block font-semibold">{FLOW_LABEL[f]}</span>
                <span className="block text-small text-ink-soft">
                  {blocked ? `Needs every vendor on a POS — ${tablet.map((x) => x.name).join(", ")} ${tablet.length === 1 ? "uses" : "use"} a tablet.` : FLOW_HINT[f]}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </Section>
  );
}

/** Single restaurant: its one vendor's POS link + menu sync. */
function PosSection({ d }: { d: AdminVenueDetailResponse }) {
  const vendor = d.vendors[0]!;
  const qc = useQueryClient();
  const { toast } = useToast();
  const pos = usePosVendors();
  const [emoji, setEmoji] = useState(vendor.emoji);
  const [posMode, setPosMode] = useState<PosMode>(vendor.posMode);
  const [posVendorId, setPosVendorId] = useState(vendor.posVendorId ?? "");
  const save = useSaveVendor(d.venue.id);
  const sync = useMutation({
    mutationFn: () => apiFetch<MenuSyncResponse>(`/v1/admin/venues/${d.venue.id}/menus/sync`, { method: "POST", json: { vendorIds: [vendor.id] } }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: qk.venue(d.venue.id) });
      const r = res.results[0];
      toast({ title: r?.ok ? `Menu synced · ${r.itemCount} items from ${r.source === "pos" ? "the POS" : "the starter menu"}` : `Sync failed: ${r?.error ?? "unknown"}`, variant: r?.ok ? "success" : "error" });
    },
    onError: (e) => toast({ title: `Sync failed: ${errorMessage(e)}`, variant: "error" }),
  });
  const used = new Set(d.vendors.map((x) => x.posVendorId));
  return (
    <Section
      title="POS & menu"
      saving={save.isPending}
      error={save.isError ? errorMessage(save.error) : null}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(
          { vendorId: vendor.id, req: { emoji: emoji.trim() || "🍽️", posMode, posVendorId: posMode === "mock_pos" ? posVendorId || null : null } },
          { onSuccess: () => toast({ title: "POS settings saved — sync the menu to pull changes", variant: "success" }) },
        );
      }}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field id="p-mode" label="Orders go to">
          <select id="p-mode" className={input} value={posMode} onChange={(e) => setPosMode(e.target.value as PosMode)} disabled={d.venue.flow === "pat"}>
            <option value="mock_pos">POS</option>
            <option value="tablet">Tablet (kitchen display)</option>
          </select>
        </Field>
        {posMode === "mock_pos" && (
          <Field id="p-pos" label="POS vendor">
            <select id="p-pos" className={input} value={posVendorId} onChange={(e) => setPosVendorId(e.target.value)}>
              <option value="">{pos.isPending ? "Loading…" : "Choose…"}</option>
              {(pos.data?.vendors ?? [])
                .filter((p) => p.posVendorId === vendor.posVendorId || !used.has(p.posVendorId))
                .map((p) => (
                  <option key={p.posVendorId} value={p.posVendorId}>
                    {p.emoji} {p.displayName} ({p.posVendorId})
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field id="p-emoji" label="Emoji">
          <input id="p-emoji" className={`${input} w-24 text-center`} value={emoji} maxLength={8} onChange={(e) => setEmoji(e.target.value)} />
        </Field>
        <Field id="p-menu" label="Menu" hint={`${vendor.itemCount} items now.`}>
          <Button id="p-menu" type="button" variant="secondary" loading={sync.isPending} onClick={() => sync.mutate()}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Sync menu now
          </Button>
        </Field>
      </div>
    </Section>
  );
}

export default function SettingsPage() {
  const { id } = useParams<{ id: string }>();
  const q = useVenue(id);
  if (q.isPending) return <Skeleton className="h-96 w-full" />;
  if (q.isError) return <ErrorState title="Couldn't load settings" body={q.error.message} retry={() => void q.refetch()} />;
  const d = q.data;
  const single = d.venue.type === "restaurant";
  // remount sections after a save so their inputs reflect the server
  const k = JSON.stringify(d.venue);
  return (
    <>
      {d.venue.status === "draft" && <DraftBanner venueId={id} />}
      <PageHeader title="Settings" subtitle={`${d.venue.name} · ${VENUE_TYPE_LABEL[d.venue.type]}`} />
      <div className="flex max-w-4xl flex-col gap-6">
        <GeneralSection key={`g${k}`} d={d} />
        {single && d.vendors[0] && <PosSection key={`p${JSON.stringify(d.vendors[0])}`} d={d} />}
        <PaymentSection key={`pay${k}`} d={d} />
        {!single && d.vendors.length > 0 && <VendorCommissionSection d={d} />}
        <FlowSection key={`f${k}${d.vendors.map((x) => x.posMode).join()}`} d={d} />
      </div>
    </>
  );
}
