"use client";
import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Search } from "lucide-react";
import { VendorOrderStatus, type VendorRange } from "@one/contracts";
import { EmptyState, ErrorState, formatMoney, Skeleton, STATUS_LABEL, StatusChip } from "@one/ui";
import { PanelPage } from "@/components/shell/PanelShell";
import { formatDateTime, Panel, RangePills, VendorCell } from "@/components/panel/ui";
import { cx } from "@/lib/cx";
import { usePanel } from "@/lib/panel";
import { useOrderList } from "@/lib/queries";

const LIMIT = 25;
const STATUSES = VendorOrderStatus.options.filter((s) => s !== "submitting");

export default function OrdersPage() {
  const { me, isManager, vendor } = usePanel();
  const [range, setRange] = useState<VendorRange>("today");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const many = isManager && !vendor;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(0), [range, status, debounced, vendor]);

  const params = new URLSearchParams({ range, page: String(page), limit: String(LIMIT), ...(status ? { status } : {}), ...(debounced ? { q: debounced } : {}) }).toString();
  const q = useOrderList(params);
  const count = q.data?.count ?? 0;
  const last = Math.max(0, Math.ceil(count / LIMIT) - 1);

  return (
    <PanelPage title="Orders" subtitle="Every QSR order your kitchen received — open one to see its items.">
      <div className="flex flex-wrap items-center gap-3">
        <RangePills value={range} onChange={setRange} />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status"
          className="h-11 rounded-full border border-line bg-surface px-4 text-body"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-brand">
          <Search className="h-4 w-4 text-ink-soft" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pickup code, table or guest"
            aria-label="Search orders"
            className="w-56 bg-transparent text-body outline-none"
          />
        </label>
      </div>

      <Panel>
        {q.isPending ? (
          <div className="flex flex-col gap-2 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState title="Couldn't load orders" body={q.error.message} retry={() => void q.refetch()} />
        ) : q.data.rows.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-8 w-8" />} title="No orders match" body="Try a longer date range or clear the filters." />
        ) : (
          <div className={cx("overflow-x-auto transition-opacity", q.isPlaceholderData && "opacity-60")}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10" />
                  <th>Time</th>
                  <th>Pickup</th>
                  {many && <th>Vendor</th>}
                  <th>Table</th>
                  <th>Guest</th>
                  <th className="text-right">Items</th>
                  <th className="text-right">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {q.data.rows.map((o) => {
                  const expanded = open === o.id;
                  return (
                    <Fragment key={o.id}>
                      <tr className="cursor-pointer hover:bg-paper" onClick={() => setOpen(expanded ? null : o.id)}>
                        <td>
                          <button type="button" aria-expanded={expanded} aria-label={`Items of order ${o.pickupCode}`} className="text-ink-soft">
                            <ChevronDown className={cx("h-4 w-4 transition", expanded && "rotate-180")} aria-hidden />
                          </button>
                        </td>
                        <td className="whitespace-nowrap tabular-nums">{formatDateTime(o.createdAt, me.venue.timezone)}</td>
                        <td className="font-display font-bold">{o.pickupCode}</td>
                        {many && (
                          <td>
                            <VendorCell vendorId={o.vendorId} />
                          </td>
                        )}
                        <td>{o.tableLabel}</td>
                        <td className="text-ink-soft">{o.guestFirstName ?? "—"}</td>
                        <td className="text-right tabular-nums">{o.items.reduce((a, i) => a + i.qty, 0)}</td>
                        <td className="text-right tabular-nums">{formatMoney(o.subtotalMinor, o.currency)}</td>
                        <td>
                          <StatusChip status={o.status} />
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-paper">
                          <td />
                          <td colSpan={many ? 8 : 7}>
                            <ul className="flex flex-col gap-1 py-1">
                              {o.items.map((it) => (
                                <li key={it.id} className="flex gap-3">
                                  <span className="w-8 font-semibold tabular-nums">{it.qty}×</span>
                                  <span className="flex-1">
                                    {it.name}
                                    {it.note && <span className="ml-2 text-ink-muted">“{it.note}”</span>}
                                  </span>
                                  <span className="tabular-nums">{formatMoney(it.lineTotalMinor, o.currency)}</span>
                                </li>
                              ))}
                            </ul>
                            {o.failureReason && <p className="mt-2 text-small text-status-failed-fg">Failed: {o.failureReason}</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-3 text-small text-ink-soft">
              <span className="tabular-nums">
                {page * LIMIT + 1}–{Math.min(count, (page + 1) * LIMIT)} of {count}
              </span>
              <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper disabled:opacity-40">
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <button type="button" disabled={page >= last} onClick={() => setPage(page + 1)} aria-label="Next page" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-paper disabled:opacity-40">
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </Panel>
    </PanelPage>
  );
}
