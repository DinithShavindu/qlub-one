"use client";
import { cx } from "@/lib/cx";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  ExternalLink,
  Link2,
  MoreVertical,
  Printer,
  QrCode,
  Search,
} from "lucide-react";
import { ApiClientError, EmptyState, ErrorState, Skeleton, apiFetch, qrPngDataUrl, qrSvg, useToast } from "@one/ui";
import type { AdminVenueSummary, QrListResponse, QrListRow, VenueType } from "@one/contracts";
import { ButtonLink } from "@/components/ButtonLink";
import { FilterBar, FilterChip, SearchPill, SelectPill, TogglePill } from "@/components/FilterBar";
import { Menu } from "@/components/Menu";
import { PageHeader } from "@/components/PageHeader";
import { PrintSheet } from "@/components/venue/PrintSheet";
import { VendorCell } from "@/components/venue/VendorCell";
import { VENUE_TYPE_LABEL } from "@/lib/format";
import { qrListParams, useQrList, useVenue, useVenues } from "@/lib/queries";

const PAGE_SIZES = [10, 25, 50, 100];
const checkbox = "h-5 w-5 cursor-pointer rounded border-line accent-brand";

/** Card label: individual vendor QRs carry the vendor name. */
const cardName = (t: QrListRow) => (t.vendor ? `${t.venue.name} · ${t.vendor.name}` : t.venue.name);

function download(filename: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Autocomplete over venues, matching name or code. Picking one scopes the list to that venue. */
function VenuePicker({ venues, onPick }: { venues: AdminVenueSummary[]; onPick: (code: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const needle = q.trim().toLowerCase();
  const matches = venues
    .filter(({ venue }) => !needle || venue.name.toLowerCase().includes(needle) || venue.code.toLowerCase().includes(needle) || venue.slug.includes(needle))
    .slice(0, 8);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="inline-flex h-12 items-center gap-2 rounded-full border border-line px-4 transition focus-within:border-brand hover:border-ink-muted">
        <Building2 className="h-5 w-5 text-ink-soft" aria-hidden />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && matches[0]) {
              onPick(matches[0].venue.code);
              setQ("");
              setOpen(false);
            }
          }}
          placeholder="Venue: all"
          aria-label="Filter by venue name or code"
          role="combobox"
          aria-expanded={open}
          aria-controls="venue-picker-list"
          className="w-40 bg-transparent text-body text-ink outline-none placeholder:text-ink"
        />
      </label>
      {open && (
        <ul id="venue-picker-list" role="listbox" className="absolute left-0 top-14 z-30 w-80 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-card">
          {matches.length === 0 && <li className="px-4 py-3 text-small text-ink-muted">No venue matches “{q}”.</li>}
          {matches.map(({ venue, tableCount }) => (
            <li key={venue.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => {
                  onPick(venue.code);
                  setQ("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-paper"
              >
                <span className="min-w-0">
                  <span className="block truncate text-body font-semibold">{venue.name}</span>
                  <span className="block text-small text-ink-muted">
                    <span className="font-mono">{venue.code}</span> · {VENUE_TYPE_LABEL[venue.type]}
                  </span>
                </span>
                <span className="shrink-0 text-small tabular-nums text-ink-muted">{tableCount} QRs</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Pagination({ page, limit, count, onPage, onLimit }: { page: number; limit: number; count: number; onPage: (p: number) => void; onLimit: (l: number) => void }) {
  const last = Math.max(0, Math.ceil(count / limit) - 1);
  const from = count ? page * limit + 1 : 0;
  const to = Math.min(count, (page + 1) * limit);
  const btn = "flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-end gap-4 border-t border-line px-6 py-4 text-small text-ink-soft">
      <label className="flex items-center gap-2">
        Rows per page
        <select value={limit} onChange={(e) => onLimit(Number(e.target.value))} className="h-9 rounded-md border border-line bg-surface px-2 text-ink">
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <span className="tabular-nums" aria-live="polite">
        {from}–{to} of {count}
      </span>
      <span className="flex items-center gap-1">
        <button type="button" className={btn} disabled={page === 0} onClick={() => onPage(0)} aria-label="First page">
          <ChevronsLeft className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" className={btn} disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" className={btn} disabled={page >= last} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" className={btn} disabled={page >= last} onClick={() => onPage(last)} aria-label="Last page">
          <ChevronsRight className="h-5 w-5" aria-hidden />
        </button>
      </span>
    </div>
  );
}

/** Print view: pages through the list (100 per call) so an export isn't capped by the table page size. */
function QrPrint({ params }: { params: string }) {
  const all = useQuery({
    queryKey: ["qr-print", params],
    queryFn: async () => {
      const rows: QrListRow[] = [];
      for (let page = 0; ; page++) {
        const res = await apiFetch<QrListResponse>(`/v1/admin/qr/list?${params}&page=${page}&limit=100`);
        rows.push(...res.rows);
        if (rows.length >= res.count || !res.rows.length) return rows;
      }
    },
  });
  if (all.isPending) return <p className="p-8 text-ink-muted">Preparing print sheet…</p>;
  if (all.isError) return <ErrorState title="Couldn't load QRs" body={all.error.message} retry={() => void all.refetch()} />;
  if (!all.data.length) return <EmptyState title="No QRs to print" body="Nothing matches these filters." className="min-h-screen" />;
  const venueNames = [...new Set(all.data.map((t) => t.venue.name))];
  return (
    <PrintSheet
      venueName={venueNames.length === 1 ? venueNames[0]! : `${venueNames.length} venues`}
      tables={all.data.map((t) => ({ ...t, venueName: cardName(t) }))}
    />
  );
}

function QrManager() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { toast } = useToast();
  const venues = useVenues();

  const venueCode = search.get("venue") ?? "";
  const vendorParam = search.get("vendor") ?? "";
  const type = (search.get("type") ?? "") as VenueType | "";
  const page = Math.max(0, Number(search.get("page") ?? 1) - 1) || 0; // URL page is 1-based, API page is 0-based
  const limit = PAGE_SIZES.includes(Number(search.get("limit"))) ? Number(search.get("limit")) : 10;
  const [qName, setQName] = useState(search.get("tableName") ?? "");
  const [qId, setQId] = useState(search.get("tableId") ?? "");
  const tableName = useDebounced(qName.trim());
  const tableId = useDebounced(qId.trim());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function setUrl(patch: Record<string, string | number | undefined>, resetPage = true) {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    if (resetPage && !("page" in patch)) next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }

  // keep the debounced searches in the URL so a filtered list can be shared
  useEffect(() => {
    if ((search.get("tableName") ?? "") !== tableName || (search.get("tableId") ?? "") !== tableId) setUrl({ tableName, tableId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName, tableId]);

  const allVenues = venues.data?.venues ?? [];
  const venue = allVenues.find((v) => v.venue.code === venueCode.toUpperCase() || v.venue.slug === venueCode.toLowerCase());
  const typeIds = type ? allVenues.filter((v) => v.venue.type === type).map((v) => v.venue.id) : undefined;
  const typeEmpty = !!typeIds && typeIds.length === 0;
  const venueDetail = useVenue(venue?.venue.id);
  const venueVendors = venueDetail.data?.vendors ?? [];
  const scopedVendor = venueVendors.find((v) => v.slug === vendorParam || v.id === vendorParam);

  const filters = useMemo(
    () => ({
      venue: venueCode || undefined,
      venueIds: typeIds?.join(","),
      vendor: vendorParam || undefined,
      tableName: tableName || undefined,
      tableId: tableId || undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [venueCode, typeIds?.join(","), vendorParam, tableName, tableId],
  );
  const params = qrListParams({ ...filters, page, limit });
  const list = useQrList(params, !type || venues.isSuccess);

  if (search.get("print") === "1") {
    const ids = search.get("ids") ?? undefined;
    return <QrPrint params={qrListParams(ids ? { ids } : filters)} />;
  }

  const rows = typeEmpty ? [] : list.data?.rows ?? [];
  const count = typeEmpty ? 0 : list.data?.count ?? 0;
  const scoped = venue ? venue.venue : null;
  const chosen = [...selected];
  const printHref = `/qrs?${qrListParams(chosen.length ? { print: 1, ids: chosen.join(",") } : { print: 1, ...filters })}`;
  const pageChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function togglePage() {
    setSelected((s) => {
      const next = new Set(s);
      for (const r of rows) {
        if (pageChecked) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }
  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", variant: "success" });
    } catch {
      toast({ title: "Couldn't copy — select the link instead", variant: "error" });
    }
  }
  async function exportPng(t: QrListRow) {
    download(`${t.venue.code}-${t.label}.png`, await qrPngDataUrl(t.url));
  }
  async function exportSvg(t: QrListRow) {
    const blob = new Blob([await qrSvg(t.url)], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    download(`${t.venue.code}-${t.label}.svg`, href);
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  const badFilter = list.isError && list.error instanceof ApiClientError && list.error.status === 400 && !!(venueCode || vendorParam);
  const addHref = scoped ? `/venues/${scoped.id}/tables${scopedVendor ? `?vendor=${scopedVendor.id}` : ""}` : "";

  return (
    <>
      <PageHeader
        title="QR Manager"
        subtitle={
          scoped
            ? `${scoped.name} · ${VENUE_TYPE_LABEL[scoped.type]} — one QR per seat, every vendor behind it.`
            : "Every venue's table QRs in one list. Pick a venue to narrow it down."
        }
        addLabel={scoped ? `Add QRs to ${scopedVendor?.name ?? scoped.name}` : "Add QRs"}
        {...(scoped ? { addHref } : {})}
      />

      <FilterBar
        actions={
          <>
            {count > 0 && (
              <ButtonLink href={printHref} external size="lg" className="rounded-lg px-7">
                Export {chosen.length ? `${chosen.length} ` : `all ${count} `}QRs
              </ButtonLink>
            )}
            {scoped ? (
              <ButtonLink href={addHref} size="lg" variant="secondary" className="rounded-lg px-7">
                Add QRs
              </ButtonLink>
            ) : (
              <span className="text-small text-ink-muted" title="QRs are created per venue">
                Pick a venue to add QRs
              </span>
            )}
          </>
        }
      >
        {venueCode ? (
          <FilterChip icon={<Building2 className="h-5 w-5" />} onClear={() => setUrl({ venue: undefined, vendor: undefined })} clearLabel="Show all venues">
            Venue: {scoped ? `${scoped.name} (${scoped.code})` : venueCode}
          </FilterChip>
        ) : (
          <VenuePicker venues={allVenues} onPick={(code) => setUrl({ venue: code })} />
        )}
        {!venueCode && (
          <>
            <TogglePill active={type === ""} onClick={() => setUrl({ type: undefined })}>
              All types
            </TogglePill>
            <TogglePill active={type === "restaurant"} onClick={() => setUrl({ type: "restaurant" })}>
              Restaurant
            </TogglePill>
            <TogglePill active={type === "food_court"} onClick={() => setUrl({ type: "food_court" })}>
              Food court
            </TogglePill>
            <TogglePill active={type === "hotel"} onClick={() => setUrl({ type: "hotel" })}>
              Hotel
            </TogglePill>
          </>
        )}
        <SelectPill id="qr-vendor" label="Vendor" value={scopedVendor?.slug ?? vendorParam} onChange={(v) => setUrl({ vendor: v })}>
          <option value="">All QRs (combined)</option>
          <option value="shared">Shared venue QRs</option>
          <option value="individual">Vendor QRs only</option>
          {venueVendors.map((vd) => (
            <option key={vd.id} value={vd.slug}>
              {vd.emoji} {vd.name} ({vd.slug})
            </option>
          ))}
        </SelectPill>
        <SearchPill value={qName} onChange={setQName} placeholder="Search table name" />
        <SearchPill value={qId} onChange={setQId} placeholder="Search table id" />
      </FilterBar>

      {badFilter ? (
        <section className="rounded-2xl border border-line bg-surface">
          <ErrorState title="Nothing matches that venue / vendor" body={list.error.message} />
        </section>
      ) : list.isError ? (
        <ErrorState title="Couldn't load QRs" body={list.error.message} retry={() => void list.refetch()} />
      ) : list.isPending && !typeEmpty ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <section className={cx("overflow-x-auto rounded-2xl border border-line bg-surface pt-6 transition-opacity", list.isFetching && list.isPlaceholderData && "opacity-60")}>
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12">
                  <input type="checkbox" className={checkbox} checked={pageChecked} onChange={togglePage} aria-label="Select all QRs on this page" />
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
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12">
                    <EmptyState
                      icon={tableName || tableId ? <Search className="h-8 w-8" /> : <QrCode className="h-8 w-8" />}
                      title={tableName || tableId ? "No QRs match these filters" : "No QRs yet"}
                      body={scoped ? "Generate table QRs for this venue." : "Onboard a venue to create its table QRs."}
                      action={scoped ? <ButtonLink href={`/venues/${scoped.id}/tables`}>Open venue QRs</ButtonLink> : undefined}
                    />
                  </td>
                </tr>
              )}
              {rows.map((t, i) => {
                const prev = rows[i - 1];
                const firstOfGroup = !!prev && (prev.venueId !== t.venueId || prev.vendorId !== t.vendorId);
                return (
                  <tr key={t.id} className={cx(selected.has(t.id) && "bg-status-new/50", firstOfGroup && "border-t-2 border-line")}>
                    <td>
                      <input type="checkbox" className={checkbox} checked={selected.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Select ${t.venue.name} ${t.label}`} />
                    </td>
                    <td>
                      <Link href={`/qrs?venue=${t.venue.code}`} className="inline-flex items-center gap-2 text-body font-semibold text-ink hover:underline" title={`Show only ${t.venue.name}`}>
                        <Link2 className="h-5 w-5 -rotate-45" aria-hidden />
                        <span>
                          {t.venue.name}
                          <span className="block text-small font-normal text-ink-muted">
                            <span className="font-mono">{t.venue.code}</span> · {VENUE_TYPE_LABEL[t.venue.type]}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="text-body">
                      {t.vendor ? (
                        <Link href={`/qrs?venue=${t.venue.code}&vendor=${t.vendor.slug}`} className="hover:underline" title={`Show only ${t.vendor.name}`}>
                          <VendorCell vendor={t.vendor} />
                        </Link>
                      ) : (
                        <VendorCell vendor={null} />
                      )}
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
                          { label: "Print this QR", icon: <Printer className="h-4 w-4" />, onSelect: () => window.open(`/qrs?print=1&ids=${t.id}`, "_blank", "noopener") },
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
                          { label: "Open venue QRs", icon: <QrCode className="h-4 w-4" />, onSelect: () => router.push(`/venues/${t.venueId}/tables`) },
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
                );
              })}
            </tbody>
          </table>
          {count > 0 && (
            <Pagination
              page={page}
              limit={limit}
              count={count}
              onPage={(p) => setUrl({ page: p + 1 }, false)}
              onLimit={(l) => setUrl({ limit: l === 10 ? undefined : l })}
            />
          )}
        </section>
      )}
      {selected.size > 0 && (
        <p className="mt-3 text-small text-ink-muted">
          {selected.size} selected across pages ·{" "}
          <button type="button" className="font-semibold text-brand hover:underline" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </p>
      )}
    </>
  );
}

export default function QrManagerPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <QrManager />
    </Suspense>
  );
}
