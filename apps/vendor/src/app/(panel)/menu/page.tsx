"use client";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, UtensilsCrossed } from "lucide-react";
import type { AvailabilityRequest, MenuItem, MenuSyncResult, VendorItemsResponse } from "@one/contracts";
import { ApiClientError, apiFetch, EmptyState, ErrorState, MoneyText, Skeleton, useToast, VendorBadge } from "@one/ui";
import { PanelPage } from "@/components/shell/PanelShell";
import { PosSyncButton } from "@/components/panel/PosSyncButton";
import { Panel } from "@/components/panel/ui";
import { Toggle } from "@/components/Toggle";
import { cx } from "@/lib/cx";
import { usePanel } from "@/lib/panel";
import { qk, useItems } from "@/lib/queries";

export default function MenuPage() {
  const { me, vendorId, vendorsById } = usePanel();
  const q = useItems();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // vendor → category → items, in menu order
  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const out = new Map<string, Map<string, MenuItem[]>>();
    for (const it of q.data?.items ?? []) {
      if (needle && !it.name.toLowerCase().includes(needle) && !it.category.toLowerCase().includes(needle)) continue;
      const byCat = out.get(it.vendorId) ?? new Map<string, MenuItem[]>();
      byCat.set(it.category, [...(byCat.get(it.category) ?? []), it]);
      out.set(it.vendorId, byCat);
    }
    return out;
  }, [q.data, search]);

  const all = q.data?.items ?? [];
  const soldOut = all.filter((i) => !i.available).length;

  async function setAvailable(item: MenuItem, available: boolean) {
    const patch = (v: boolean) =>
      qc.setQueryData<VendorItemsResponse>(qk.items(vendorId), (old) => (old ? { items: old.items.map((i) => (i.id === item.id ? { ...i, available: v } : i)) } : old));
    patch(available);
    setBusy((b) => ({ ...b, [item.id]: true }));
    try {
      const body: AvailabilityRequest = { available };
      await apiFetch<MenuItem>(`/v1/vendor/items/${encodeURIComponent(item.id)}/availability`, { method: "POST", json: body });
      toast({ title: available ? `${item.name} is back on the menu` : `${item.name} marked sold out`, variant: "success" });
    } catch (e) {
      patch(!available);
      toast({ title: e instanceof ApiClientError ? `Couldn't update — ${e.message}` : "Couldn't update", variant: "error" });
    } finally {
      setBusy((b) => ({ ...b, [item.id]: false }));
    }
  }

  return (
    <PanelPage
      title="Menu"
      subtitle={q.data ? `${all.length} items · ${soldOut} sold out — sold-out items are hidden from guests right away.` : undefined}
      actions={
        <PosSyncButton<MenuSyncResult>
          path="/v1/vendor/menu/sync"
          label="Sync menu from POS"
          what="sync its menu from the POS"
          onDone={(r) => {
            void qc.invalidateQueries({ queryKey: ["vendor", "items"] });
            return `Menu synced · ${r.itemCount} items in ${(r.durationMs / 1000).toFixed(1)}s`;
          }}
        />
      }
    >
      <label className="inline-flex h-11 w-full max-w-sm items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-brand">
        <Search className="h-4 w-4 text-ink-soft" aria-hidden />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items or categories" aria-label="Search menu" className="w-full bg-transparent text-body outline-none" />
      </label>

      {q.isPending ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : q.isError ? (
        <ErrorState title="Couldn't load the menu" body={q.error.message} retry={() => void q.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed className="h-8 w-8" />} title="No menu items yet" body="Sync your menu from the POS to bring it in." />
      ) : groups.size === 0 ? (
        <EmptyState icon={<Search className="h-8 w-8" />} title={`Nothing matches “${search}”`} />
      ) : (
        [...groups.entries()].map(([vid, cats]) => {
          const v = vendorsById.get(vid);
          return (
            <Panel key={vid} title={v ? <VendorBadge vendor={v} size="md" /> : "Vendor"}>
              {[...cats.entries()].map(([cat, items]) => (
                <div key={cat}>
                  <h3 className="bg-paper px-5 py-2 text-micro font-semibold uppercase tracking-wide text-ink-muted">{cat}</h3>
                  <ul className="divide-y divide-line">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center gap-4 px-5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className={cx("truncate font-semibold", !item.available && "text-ink-muted line-through")}>{item.name}</p>
                          {item.description && <p className="truncate text-small text-ink-muted">{item.description}</p>}
                        </div>
                        <MoneyText minor={item.priceMinor} currency={me.venue.currency} className="tabular-nums" />
                        <span className={cx("hidden w-20 text-right text-small sm:inline", item.available ? "text-ink-muted" : "font-semibold text-brand-strong")}>
                          {item.available ? "Available" : "Sold out"}
                        </span>
                        <Toggle checked={item.available} onChange={(on) => void setAvailable(item, on)} label={`${item.name} available`} disabled={busy[item.id]} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Panel>
          );
        })
      )}
    </PanelPage>
  );
}
