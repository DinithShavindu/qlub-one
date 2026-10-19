"use client";
import { cx } from "@/lib/cx";
import { Suspense, useMemo, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, Copy, Download, ExternalLink, LayoutGrid, Link2, List, MoreVertical, Printer, QrCode } from "lucide-react";
import { Button, EmptyState, ErrorState, Skeleton, apiFetch, qrPngDataUrl, qrSvg, useToast } from "@one/ui";
import type { AdminVendor, TablesResponse, TableWithUrl } from "@one/contracts";
import { ButtonLink } from "@/components/ButtonLink";
import { FilterBar, FilterChip, SearchPill, SelectPill } from "@/components/FilterBar";
import { Menu } from "@/components/Menu";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { DraftBanner } from "@/components/venue/DraftBanner";
import { PrintSheet } from "@/components/venue/PrintSheet";
import { QrGrid } from "@/components/venue/QrGrid";
import { VendorCell } from "@/components/venue/VendorCell";
import { errorMessage, qk, useTables, useVenue } from "@/lib/queries";

function download(filename: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

const checkbox = "h-5 w-5 cursor-pointer rounded border-line accent-brand";

/** Card / print label: vendor QRs carry the vendor name so stall staff can tell them apart. */
const cardName = (venueName: string, t: TableWithUrl, vendors: Map<string, AdminVendor>) => {
  const vendor = t.vendorId ? vendors.get(t.vendorId) : undefined;
  return vendor ? `${venueName} · ${vendor.name}` : venueName;
};

function TablesView() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const print = search.get("print") === "1";
  const venue = useVenue(id);
  const tables = useTables(id);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [count, setCount] = useState("4");
  const [adding, setAdding] = useState(false);
  const [qLabel, setQLabel] = useState("");
  const [qToken, setQToken] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  // "" = combined (every QR), "shared" = venue-wide QRs, otherwise one vendor's id
  const [vendorFilter, setVendorFilter] = useState(search.get("vendor") ?? "");
  const [addFor, setAddFor] = useState(search.get("vendor") && search.get("vendor") !== "shared" ? search.get("vendor")! : "");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const add = useMutation({
    mutationFn: ({ n, vendorId, prefix }: { n: number; vendorId?: string; prefix: string }) =>
      apiFetch<TablesResponse>(`/v1/admin/venues/${id}/tables`, { method: "POST", json: { count: n, prefix, ...(vendorId ? { vendorId } : {}) } }),
    onSuccess: (res) => {
      qc.setQueryData(qk.tables(id), res);
      void qc.invalidateQueries({ queryKey: qk.venue(id) });
      setAdding(false);
      toast({ title: "Tables added", variant: "success" });
    },
  });

  const list = tables.data?.tables;
  const vendorList = venue.data?.vendors;
  const vendorsById = useMemo(() => new Map((vendorList ?? []).map((v) => [v.id, v])), [vendorList]);
  const filtered = useMemo(() => {
    const l = qLabel.trim().toLowerCase();
    const t = qToken.trim().toLowerCase();
    return (list ?? [])
      .filter((x) => (!l || x.label.toLowerCase().includes(l)) && (!t || x.qrToken.toLowerCase().includes(t)))
      .filter((x) => (vendorFilter === "" ? true : vendorFilter === "shared" ? !x.vendorId : x.vendorId === vendorFilter))
      .sort((a, b) => (a.vendorId ? vendorsById.get(a.vendorId)?.sortOrder ?? 0 : -1) - (b.vendorId ? vendorsById.get(b.vendorId)?.sortOrder ?? 0 : -1));
  }, [list, qLabel, qToken, vendorFilter, vendorsById]);

  if (venue.isPending || tables.isPending) {
    return print ? (
      <p className="p-8 text-ink-muted">Preparing print sheet…</p>
    ) : (
      <>
        <Skeleton className="mb-8 h-10 w-48" />
        <Skeleton className="mb-6 h-24 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
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
  const all = tables.data.tables;

  if (print) {
    const ids = search.get("ids")?.split(",").filter(Boolean);
    const sheet = ids?.length ? all.filter((t) => ids.includes(t.id)) : all;
    if (!sheet.length) return <EmptyState title="No tables to print" body="Generate tables first." className="min-h-screen" />;
    return <PrintSheet venueName={v.name} tables={sheet.map((t) => ({ ...t, venueName: cardName(v.name, t, vendorsById) }))} />;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(count);
    const vendor = addFor ? vendorsById.get(addFor) : undefined;
    if (Number.isInteger(n) && n >= 1 && n <= 200) add.mutate({ n, vendorId: vendor?.id, prefix: vendor ? vendor.letter : "T" });
  }

  function toggle(tid: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(tid)) next.delete(tid);
      else next.add(tid);
      return next;
    });
  }
  const allChecked = filtered.length > 0 && filtered.every((t) => selected.has(t.id));
  const chosen = all.filter((t) => selected.has(t.id));
  const printHref = `/venues/${id}/tables?print=1${chosen.length ? `&ids=${chosen.map((t) => t.id).join(",")}` : ""}`;

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", variant: "success" });
    } catch {
      toast({ title: "Couldn't copy — select the link instead", variant: "error" });
    }
  }
  async function exportPng(t: TableWithUrl) {
    download(`${v.code}-${t.label}.png`, await qrPngDataUrl(t.url));
  }
  async function exportSvg(t: TableWithUrl) {
    const blob = new Blob([await qrSvg(t.url)], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    download(`${v.code}-${t.label}.svg`, href);
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  return (
    <>
      {v.status === "draft" && <DraftBanner venueId={id} />}
      <PageHeader
        title="QRs"
        subtitle="Shared QRs open every vendor; a vendor's own QRs open just that stall."
        addLabel="Add tables"
        {...(v.status === "live" ? { onAdd: () => setAdding(true) } : { addHref: `/venues/new?id=${id}` })}
      />

      <FilterBar
        actions={
          <>
            <button
              type="button"
              onClick={() => setView(view === "list" ? "grid" : "list")}
              aria-label={view === "list" ? "Show QR grid" : "Show list"}
              title={view === "list" ? "Show QR grid" : "Show list"}
              className="flex h-12 w-12 items-center justify-center rounded-full text-ink-soft hover:bg-paper"
            >
              {view === "list" ? <LayoutGrid className="h-5 w-5" aria-hidden /> : <List className="h-5 w-5" aria-hidden />}
            </button>
            {all.length > 0 && (
              <ButtonLink href={printHref} external size="lg" className="rounded-lg px-7">
                Export {chosen.length ? `${chosen.length} ` : ""}QRs
              </ButtonLink>
            )}
            {v.status === "live" && (
              <Button size="lg" className="rounded-lg px-7" onClick={() => setAdding(true)}>
                Add tables
              </Button>
            )}
          </>
        }
      >
        <FilterChip icon={<Building2 className="h-5 w-5" />} clearHref="/venues" clearLabel="Back to all venues">
          Venue: {v.name}
        </FilterChip>
        {venue.data.vendors.length > 0 && (
          <SelectPill id="vendor-filter" label="Vendor" value={vendorFilter} onChange={setVendorFilter}>
            <option value="">All QRs (combined)</option>
            <option value="shared">Shared venue QRs</option>
            {venue.data.vendors.map((vd) => (
              <option key={vd.id} value={vd.id}>
                {vd.emoji} {vd.name}
              </option>
            ))}
          </SelectPill>
        )}
        <SearchPill value={qLabel} onChange={setQLabel} placeholder="Search table name" />
        <SearchPill value={qToken} onChange={setQToken} placeholder="Search table id" />
      </FilterBar>

      {all.length === 0 ? (
        <section className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={<QrCode className="h-8 w-8" />}
            title="No tables yet"
            body="Generate table QR codes in the onboarding wizard."
            action={<ButtonLink href={`/venues/new?id=${id}`}>Continue setup</ButtonLink>}
          />
        </section>
      ) : view === "grid" ? (
        <QrGrid venueName={v.name} tables={filtered.map((t) => ({ ...t, venueName: cardName(v.name, t, vendorsById) }))} />
      ) : (
        <section className="overflow-x-auto rounded-2xl border border-line bg-surface pt-6">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    className={checkbox}
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? new Set() : new Set(filtered.map((t) => t.id)))}
                    aria-label="Select all tables"
                  />
                </th>
                <th>Venue</th>
                <th>Vendor</th>
                <th>Url</th>
                <th>Table</th>
                <th>Table id</th>
                <th>Export</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink-muted">
                    No tables match these filters.
                  </td>
                </tr>
              )}
              {filtered.map((t) => (
                <tr key={t.id} className={cx(selected.has(t.id) && "bg-status-new/50")}>
                  <td>
                    <input type="checkbox" className={checkbox} checked={selected.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Select ${t.label}`} />
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-2 text-body font-semibold">
                      <Link2 className="h-5 w-5 -rotate-45" aria-hidden />
                      {v.name}
                    </span>
                  </td>
                  <td className="text-body">
                    <VendorCell vendor={t.vendorId ? vendorsById.get(t.vendorId) : undefined} />
                  </td>
                  <td>
                    <div className="flex max-w-[360px] items-center gap-3">
                      <button type="button" onClick={() => void copy(t.url)} aria-label={`Copy link for ${t.label}`} title="Copy link" className="shrink-0 text-brand hover:text-brand-strong">
                        <Copy className="h-5 w-5" aria-hidden />
                      </button>
                      <span className="break-all text-body">{t.url}</span>
                    </div>
                  </td>
                  <td className="text-body">{t.label}</td>
                  <td className="text-body">
                    <span title={t.qrToken}>{t.qrToken.length > 8 ? `${t.qrToken.slice(0, 7)}…` : t.qrToken}</span>
                  </td>
                  <td>
                    <Menu
                      label={`Export options for ${t.label}`}
                      items={[
                        { label: "Download PNG", icon: <Download className="h-4 w-4" />, onSelect: () => void exportPng(t) },
                        { label: "Download SVG", icon: <Download className="h-4 w-4" />, onSelect: () => void exportSvg(t) },
                        { label: "Print this QR", icon: <Printer className="h-4 w-4" />, onSelect: () => window.open(`/venues/${id}/tables?print=1&ids=${t.id}`, "_blank", "noopener") },
                      ]}
                      trigger={({ open, toggle: t2 }) => (
                        <span className="inline-flex overflow-hidden rounded-lg bg-brand text-on-brand">
                          <button type="button" onClick={() => void exportPng(t)} className="h-12 px-8 text-body font-semibold transition hover:bg-brand-strong">
                            Export
                          </button>
                          <button
                            type="button"
                            onClick={t2}
                            aria-expanded={open}
                            aria-label={`More export options for ${t.label}`}
                            className="flex h-12 w-12 items-center justify-center border-l border-white/25 transition hover:bg-brand-strong"
                          >
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          </button>
                        </span>
                      )}
                    />
                  </td>
                  <td>
                    <Menu
                      label={`Actions for ${t.label}`}
                      items={[
                        { label: "Copy link", icon: <Copy className="h-4 w-4" />, onSelect: () => void copy(t.url) },
                        { label: "Open guest page", icon: <ExternalLink className="h-4 w-4" />, onSelect: () => window.open(t.url, "_blank", "noopener") },
                      ]}
                      trigger={({ open, toggle: t2 }) => (
                        <button
                          type="button"
                          onClick={t2}
                          aria-expanded={open}
                          aria-label={`Actions for ${t.label}`}
                          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-surface-sunk"
                        >
                          <MoreVertical className="h-5 w-5" aria-hidden />
                        </button>
                      )}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <Modal
        open={adding}
        onClose={() => {
          setAdding(false);
          add.reset();
        }}
        title="Add tables"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-tables" loading={add.isPending}>
              Add tables
            </Button>
          </>
        }
      >
        <form id="add-tables" onSubmit={submit}>
          {venue.data.vendors.length > 0 && (
            <>
              <label htmlFor="add-for" className="mb-1 block text-small font-semibold">
                QRs for
              </label>
              <select id="add-for" value={addFor} onChange={(e) => setAddFor(e.target.value)} className="mb-4 h-11 w-full rounded-lg border border-line bg-surface px-3">
                <option value="">All vendors — shared venue QR</option>
                {venue.data.vendors.map((vd) => (
                  <option key={vd.id} value={vd.id}>
                    {vd.emoji} {vd.name} only
                  </option>
                ))}
              </select>
            </>
          )}
          <label htmlFor="add-count" className="mb-1 block text-small font-semibold">
            How many?
          </label>
          <input
            id="add-count"
            autoFocus
            inputMode="numeric"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="h-11 w-28 rounded-lg border border-line bg-surface px-3"
          />
          <p className="mt-2 text-small text-ink-muted">Adds after the existing tables — printed QRs keep working.</p>
          {add.isError && <p className="mt-2 text-small text-status-failed-fg">{errorMessage(add.error)}</p>}
        </form>
      </Modal>
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
