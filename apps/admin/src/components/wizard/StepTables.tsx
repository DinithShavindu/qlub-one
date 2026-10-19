"use client";
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Info, Printer, QrCode } from "lucide-react";
import { Button, EmptyState, ErrorState, Skeleton, apiFetch } from "@one/ui";
import type { AdminVenueDetailResponse, TablesResponse } from "@one/contracts";
import { ButtonLink } from "@/components/ButtonLink";
import { QrGrid } from "@/components/venue/QrGrid";
import { errorMessage, qk, useTables } from "@/lib/queries";

const input = "h-11 rounded-md border border-line bg-surface px-3 text-body";

export function StepTables({ detail, onBack, onNext }: { detail: AdminVenueDetailResponse; onBack: () => void; onNext: () => void }) {
  const venueId = detail.venue.id;
  const qc = useQueryClient();
  const tables = useTables(venueId);
  const [count, setCount] = useState(String(detail.tableCount || 12));
  const [prefix, setPrefix] = useState("T");
  const [formError, setFormError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: (body: { count: number; prefix: string }) =>
      apiFetch<TablesResponse>(`/v1/admin/venues/${venueId}/tables`, { method: "POST", json: body }),
    onSuccess: (res) => {
      qc.setQueryData(qk.tables(venueId), res);
      qc.setQueryData<AdminVenueDetailResponse>(qk.venue(venueId), (prev) => (prev ? { ...prev, tableCount: res.tables.length } : prev));
      void qc.invalidateQueries({ queryKey: qk.venue(venueId) });
      void qc.invalidateQueries({ queryKey: qk.venues });
    },
    onError: (e) => setFormError(errorMessage(e)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 200) return setFormError("Enter between 1 and 200 tables.");
    if (prefix.trim().length > 6) return setFormError("Prefix can be at most 6 characters.");
    setFormError(null);
    gen.mutate({ count: n, prefix: prefix.trim() });
  }

  const list = tables.data?.tables ?? [];

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-4 rounded-lg border border-line bg-surface px-5 py-4">
        <div>
          <label htmlFor="table-count" className="mb-1 block text-small font-semibold">
            Number of tables
          </label>
          <input id="table-count" inputMode="numeric" className={`${input} w-32`} value={count} onChange={(e) => setCount(e.target.value)} />
        </div>
        <div>
          <label htmlFor="table-prefix" className="mb-1 block text-small font-semibold">
            Label prefix
          </label>
          <input id="table-prefix" className={`${input} w-24`} value={prefix} maxLength={6} onChange={(e) => setPrefix(e.target.value)} />
        </div>
        <Button type="submit" size="lg" loading={gen.isPending}>
          <QrCode className="h-4 w-4" aria-hidden /> {list.length ? "Regenerate" : "Generate"}
        </Button>
        {list.length > 0 && (
          <ButtonLink href={`/venues/${venueId}/tables?print=1`} external variant="secondary" size="lg">
            <Printer className="h-4 w-4" aria-hidden /> Print sheet
          </ButtonLink>
        )}
        <p className="basis-full text-small text-ink-muted">
          {detail.venue.status === "draft"
            ? `Labels run ${prefix || ""}1…${prefix || ""}${count || "N"}. Regenerating replaces the set while the venue is a draft.`
            : "This venue is live — generating adds tables after the existing ones, so printed QRs keep working."}
        </p>
        {formError && (
          <p role="alert" className="basis-full text-small text-status-failed-fg">
            {formError}
          </p>
        )}
      </form>

      <p className="flex items-center gap-3 rounded-md bg-status-new px-4 py-3 text-small font-semibold text-status-new-fg">
        <Info className="h-4 w-4 shrink-0" aria-hidden />
        One QR per seat works for every vendor — no per-stall QR codes.
      </p>

      {tables.isPending ? (
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : tables.isError ? (
        <ErrorState title="Couldn't load tables" body={tables.error.message} retry={() => void tables.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={<QrCode className="h-8 w-8" />} title="No tables yet" body="Set how many tables the seating area has, then Generate." />
      ) : (
        <QrGrid venueName={detail.venue.name} tables={list} />
      )}

      <div className="flex items-center justify-between border-t border-line pt-6">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <Button size="lg" disabled={!list.length} onClick={onNext}>
          Review &amp; go live <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
