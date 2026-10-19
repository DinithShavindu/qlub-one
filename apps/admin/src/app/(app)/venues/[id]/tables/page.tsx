"use client";
import { Suspense, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Plus, Printer, QrCode } from "lucide-react";
import { Button, EmptyState, ErrorState, Skeleton, apiFetch } from "@one/ui";
import type { TablesResponse } from "@one/contracts";
import { ButtonLink } from "@/components/ButtonLink";
import { PageHeader } from "@/components/PageHeader";
import { DraftBanner } from "@/components/venue/DraftBanner";
import { PrintSheet } from "@/components/venue/PrintSheet";
import { QrGrid } from "@/components/venue/QrGrid";
import { errorMessage, qk, useTables, useVenue } from "@/lib/queries";

function TablesView() {
  const { id } = useParams<{ id: string }>();
  const print = useSearchParams().get("print") === "1";
  const venue = useVenue(id);
  const tables = useTables(id);
  const qc = useQueryClient();
  const [count, setCount] = useState("4");

  const add = useMutation({
    mutationFn: (n: number) => apiFetch<TablesResponse>(`/v1/admin/venues/${id}/tables`, { method: "POST", json: { count: n, prefix: "T" } }),
    onSuccess: (res) => {
      qc.setQueryData(qk.tables(id), res);
      void qc.invalidateQueries({ queryKey: qk.venue(id) });
    },
  });

  if (venue.isPending || tables.isPending) {
    return print ? (
      <p className="p-8 text-ink-muted">Preparing print sheet…</p>
    ) : (
      <>
        <Skeleton className="mb-6 h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </>
    );
  }
  if (venue.isError || tables.isError) {
    const err = venue.error ?? tables.error;
    return (
      <ErrorState
        title="Couldn't load tables"
        body={err?.message}
        retry={() => {
          void venue.refetch();
          void tables.refetch();
        }}
      />
    );
  }

  const v = venue.data.venue;
  const list = tables.data.tables;

  if (print) {
    if (!list.length) return <EmptyState title="No tables to print" body="Generate tables first." className="min-h-screen" />;
    return <PrintSheet venueName={v.name} tables={list} />;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(count);
    if (Number.isInteger(n) && n >= 1 && n <= 200) add.mutate(n);
  }

  return (
    <>
      {v.status === "draft" && <DraftBanner venueId={id} />}
      <PageHeader
        title="Tables & QR"
        subtitle={`${v.name} · ${list.length} tables`}
        actions={
          list.length > 0 && (
            <ButtonLink href={`/venues/${id}/tables?print=1`} external>
              <Printer className="h-4 w-4" aria-hidden /> Print sheet
            </ButtonLink>
          )
        }
      />
      <p className="mb-6 flex items-center gap-3 rounded-md bg-status-new px-4 py-3 text-small font-semibold text-status-new-fg">
        <Info className="h-4 w-4 shrink-0" aria-hidden />
        One QR per seat works for every vendor — no per-stall QR codes.
      </p>
      {v.status === "live" && (
        <form onSubmit={submit} className="mb-6 flex items-end gap-3">
          <div>
            <label htmlFor="add-count" className="mb-1 block text-small font-semibold">
              Add tables
            </label>
            <input
              id="add-count"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="h-11 w-24 rounded-md border border-line bg-surface px-3"
            />
          </div>
          <Button type="submit" variant="secondary" loading={add.isPending}>
            <Plus className="h-4 w-4" aria-hidden /> Add
          </Button>
          <p className="text-small text-ink-muted">Adds after the existing tables — printed QRs keep working.</p>
          {add.isError && <p className="text-small text-status-failed-fg">{errorMessage(add.error)}</p>}
        </form>
      )}
      {list.length === 0 ? (
        <EmptyState
          icon={<QrCode className="h-8 w-8" />}
          title="No tables yet"
          body="Generate table QR codes in the onboarding wizard."
          action={<ButtonLink href={`/venues/new?id=${id}`}>Continue setup</ButtonLink>}
        />
      ) : (
        <QrGrid venueName={v.name} tables={list} />
      )}
    </>
  );
}

export default function TablesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <TablesView />
    </Suspense>
  );
}
