"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, apiFetch } from "@one/ui";
import { OrderFlow, PaymentGateway, type CreateRestaurantRequest, type CreateRestaurantResponse, type PosMode } from "@one/contracts";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { PinRevealModal, type PinRow } from "@/components/wizard/PinRevealModal";
import { FLOW_HINT, FLOW_LABEL, GATEWAY_LABEL, parseFeePct } from "@/lib/format";
import { errorMessage, qk, usePosVendors } from "@/lib/queries";

const input = "h-11 w-full rounded-md border border-line bg-surface px-3 text-body disabled:bg-surface-sunk disabled:text-ink-soft";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title}>
      <div className="grid gap-5 p-6 md:grid-cols-2">{children}</div>
    </Card>
  );
}

export default function NewRestaurantPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const pos = usePosVendors();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍽️");
  const [posMode, setPosMode] = useState<PosMode>("mock_pos");
  const [posVendorId, setPosVendorId] = useState("");
  const [tables, setTables] = useState("10");
  const [flow, setFlow] = useState<OrderFlow>("qsr");
  const [gateway, setGateway] = useState<PaymentGateway>("qlub_test");
  const [merchantId, setMerchantId] = useState("");
  const [fee, setFee] = useState("1.0");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreateRestaurantResponse | null>(null);

  const create = useMutation({
    mutationFn: (req: CreateRestaurantRequest) => apiFetch<CreateRestaurantResponse>("/v1/admin/restaurants", { method: "POST", json: req }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: qk.venues });
      setCreated(res);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const feeBps = parseFeePct(fee);
    const tableCount = Number(tables);
    if (trimmed.length < 2 || trimmed.length > 40) return setError("Restaurant name must be 2–40 characters.");
    if (posMode === "mock_pos" && !posVendorId) return setError("Pick the POS this restaurant uses.");
    if (flow === "pat" && posMode !== "mock_pos") return setError("Pay at table reads the bill from the POS — connect a POS or use QSR.");
    if (feeBps === null) return setError("Commission must be 0–20%, up to 2 decimals.");
    if (!Number.isInteger(tableCount) || tableCount < 0 || tableCount > 200) return setError("Tables must be 0–200.");
    setError(null);
    create.mutate({
      name: trimmed,
      emoji: emoji.trim() || "🍽️",
      posMode,
      ...(posMode === "mock_pos" ? { posVendorId } : {}),
      tableCount,
      flow,
      gateway,
      gatewayMerchantId: merchantId.trim() || null,
      feeBps,
    });
  }

  const directory = pos.data?.vendors ?? [];
  const pins: PinRow[] | null = created ? [{ vendorId: created.vendor.id, name: created.vendor.name, pin: created.pin }] : null;

  return (
    <>
      <PageHeader title="New restaurant" subtitle="A single venue with one restaurant. Everything here can be changed later in the restaurant's Settings." />
      <form onSubmit={submit} noValidate className="flex max-w-4xl flex-col gap-6">
        <Section title="Restaurant">
          <Field id="r-name" label="Restaurant name">
            <input id="r-name" autoFocus className={input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Digipos Test" />
          </Field>
          <Field id="r-emoji" label="Emoji" hint="Shown to guests and on the kitchen display.">
            <input id="r-emoji" className={`${input} w-24 text-center`} value={emoji} maxLength={8} onChange={(e) => setEmoji(e.target.value)} />
          </Field>
        </Section>

        <Section title="POS">
          <Field id="r-mode" label="Orders go to">
            <select
              id="r-mode"
              className={input}
              value={posMode}
              onChange={(e) => {
                const m = e.target.value as PosMode;
                setPosMode(m);
                if (m === "tablet") setFlow("qsr");
              }}
            >
              <option value="mock_pos">POS — menu and tables from the POS</option>
              <option value="tablet">Tablet (kitchen display) — starter menu</option>
            </select>
          </Field>
          {posMode === "mock_pos" && (
            <Field id="r-pos" label="POS vendor" hint={pos.isError ? `Couldn't reach the POS directory: ${errorMessage(pos.error)}` : undefined}>
              <select
                id="r-pos"
                className={input}
                value={posVendorId}
                onChange={(e) => {
                  setPosVendorId(e.target.value);
                  const p = directory.find((x) => x.posVendorId === e.target.value);
                  if (p && !name.trim()) {
                    setName(p.displayName);
                    setEmoji(p.emoji);
                  }
                }}
              >
                <option value="">{pos.isPending ? "Loading POS directory…" : "Choose…"}</option>
                {directory.map((p) => (
                  <option key={p.posVendorId} value={p.posVendorId}>
                    {p.emoji} {p.displayName} ({p.posVendorId})
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field id="r-tables" label="Table QRs" hint="Labelled T1, T2, … Add more later in the QR Manager.">
            <input id="r-tables" inputMode="numeric" className={`${input} w-28`} value={tables} onChange={(e) => setTables(e.target.value)} />
          </Field>
        </Section>

        <Section title="Payment gateway & commission">
          <Field id="r-gateway" label="Payment gateway">
            <select id="r-gateway" className={input} value={gateway} onChange={(e) => setGateway(e.target.value as PaymentGateway)}>
              {PaymentGateway.options.map((g) => (
                <option key={g} value={g}>
                  {GATEWAY_LABEL[g]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="r-merchant" label="Gateway merchant id" hint="Optional.">
            <input id="r-merchant" className={input} value={merchantId} maxLength={60} onChange={(e) => setMerchantId(e.target.value)} />
          </Field>
          <Field id="r-fee" label="qlub commission %" hint="Taken from every order, e.g. 1.0% = 100 bps.">
            <input id="r-fee" inputMode="decimal" className={`${input} w-28`} value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
        </Section>

        <Section title="Flow setup">
          <fieldset className="md:col-span-2">
            <legend className="sr-only">Flow</legend>
            <div className="grid gap-3 md:grid-cols-2">
              {OrderFlow.options.map((f) => {
                const disabled = f === "pat" && posMode !== "mock_pos";
                return (
                  <label
                    key={f}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${flow === f ? "border-brand bg-status-new/40" : "border-line"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <input type="radio" name="flow" className="mt-1 accent-brand" checked={flow === f} disabled={disabled} onChange={() => setFlow(f)} />
                    <span>
                      <span className="block font-semibold">{FLOW_LABEL[f]}</span>
                      <span className="block text-small text-ink-soft">{disabled ? "Needs a POS — the bill lives there." : FLOW_HINT[f]}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Section>

        {error && (
          <p role="alert" className="rounded-md bg-status-failed px-4 py-3 text-small font-semibold text-status-failed-fg">
            {error}
          </p>
        )}
        <div>
          <Button type="submit" size="lg" loading={create.isPending}>
            Create restaurant
          </Button>
        </div>
      </form>

      <PinRevealModal
        pins={pins}
        venueCode={created?.venue.code ?? ""}
        doneLabel="I've saved the PIN — open the restaurant"
        onDone={() => {
          if (!created) return;
          const id = created.venue.id;
          setCreated(null);
          router.push(created.venue.status === "live" ? `/venues/${id}` : `/venues/${id}/settings`);
        }}
      />
      {created?.menuError && (
        <p role="status" className="mt-4 text-small text-status-failed-fg">
          Created, but the menu needs attention: {created.menuError}
        </p>
      )}
    </>
  );
}
