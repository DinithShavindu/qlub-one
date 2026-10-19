"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@one/ui";
import type { CreateVenueRequest, Venue, VenueType } from "@one/contracts";
import { VENUE_TYPE_LABEL } from "@/lib/format";

const TYPE_HINT: Record<VenueType, string> = {
  food_court: "Many vendors, shared seating, one QR per seat.",
  hotel: "Restaurants, bars and room service under one roof, one QR per table or room.",
};

const input = "h-11 w-full rounded-md border border-line bg-surface px-3 text-body disabled:bg-surface-sunk disabled:text-ink-soft";

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-small font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-small text-status-failed-fg">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-small text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

export function StepVenueForm({
  venue,
  submitting,
  serverError,
  onSubmit,
}: {
  venue: Venue | null;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (req: CreateVenueRequest) => void;
}) {
  const [name, setName] = useState(venue?.name ?? "Harbour Food Hall");
  const [type, setType] = useState<VenueType>(venue?.type ?? "food_court");
  const [fee, setFee] = useState(venue ? (venue.feeBps / 100).toFixed(1) : "1.0");
  const [errors, setErrors] = useState<{ name?: string; fee?: string }>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) next.name = "Name must be 2–60 characters.";
    const feeNum = Number(fee);
    if (!/^\d+(\.\d{1,2})?$/.test(fee.trim()) || feeNum > 20) next.fee = "Enter a fee between 0 and 20%, up to 2 decimals.";
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({ name: trimmed, type, currency: "AED", timezone: "Asia/Dubai", feeBps: Math.round(feeNum * 100) });
  }

  return (
    <form onSubmit={submit} noValidate className="grid max-w-2xl gap-5">
      <Field id="venue-name" label="Venue name" error={errors.name}>
        <input
          id="venue-name"
          className={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "venue-name-error" : undefined}
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-5">
        <Field id="venue-type" label="Venue type" hint={TYPE_HINT[type]}>
          <select id="venue-type" className={input} value={type} onChange={(e) => setType(e.target.value as VenueType)}>
            {(Object.keys(VENUE_TYPE_LABEL) as VenueType[]).map((t) => (
              <option key={t} value={t}>
                {VENUE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="venue-currency" label="Currency">
          <select id="venue-currency" className={input} value="AED" disabled>
            <option value="AED">AED — UAE dirham</option>
          </select>
        </Field>
        <Field id="venue-tz" label="Timezone">
          <select id="venue-tz" className={input} value="Asia/Dubai" disabled>
            <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
          </select>
        </Field>
        <Field id="venue-fee" label="qlub fee %" hint="Taken per vendor order, e.g. 1.0% = 100 bps." error={errors.fee}>
          <input
            id="venue-fee"
            className={input}
            inputMode="decimal"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            aria-invalid={!!errors.fee}
            aria-describedby={errors.fee ? "venue-fee-error" : undefined}
          />
        </Field>
      </div>
      {serverError && (
        <p role="alert" className="rounded-md bg-status-failed px-4 py-3 text-small font-semibold text-status-failed-fg">
          {serverError}
        </p>
      )}
      <div>
        <Button type="submit" size="lg" loading={submitting}>
          Continue
        </Button>
      </div>
    </form>
  );
}
