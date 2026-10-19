"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Armchair, Copy, Link2, QrCode, X } from "lucide-react";
import type { TableSyncResponse, VendorTableRow } from "@one/contracts";
import { EmptyState, ErrorState, QrCard, Skeleton, useToast, VendorBadge } from "@one/ui";
import { PanelPage } from "@/components/shell/PanelShell";
import { PosSyncButton } from "@/components/panel/PosSyncButton";
import { cx } from "@/lib/cx";
import { usePanel } from "@/lib/panel";
import { useTables } from "@/lib/queries";

function TableCard({ t, onShow }: { t: VendorTableRow; onShow: () => void }) {
  const { vendorsById } = usePanel();
  const { toast } = useToast();
  const owner = t.vendorId ? vendorsById.get(t.vendorId) : undefined;
  const busy = t.openOrders > 0;
  return (
    <article className={cx("flex flex-col gap-3 rounded-2xl border bg-surface p-4", busy ? "border-brand/60" : "border-line")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-h2 font-bold">{t.label}</p>
          <p className="mt-0.5 text-small text-ink-muted">{owner ? <VendorBadge vendor={owner} size="sm" /> : "All vendors"}</p>
        </div>
        <span
          className={cx("shrink-0 rounded-full px-2.5 py-1 text-micro font-semibold", busy ? "bg-status-new text-status-new-fg" : "bg-surface-sunk text-ink-soft")}
          title="Orders not yet collected"
        >
          {busy ? `${t.openOrders} open` : "Free"}
        </span>
      </div>
      <div className="mt-auto flex items-center gap-2 text-small">
        {t.posTableId ? (
          <span className="inline-flex items-center gap-1 text-ink-soft" title={`POS table ${t.posTableId}`}>
            <Link2 className="h-4 w-4" aria-hidden /> POS
          </span>
        ) : (
          <span className="text-ink-muted">qlub only</span>
        )}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(t.url);
              toast({ title: `${t.label} link copied`, variant: "success" });
            } catch {
              toast({ title: "Couldn't copy the link", variant: "error" });
            }
          }}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-surface-sunk"
          aria-label={`Copy link for ${t.label}`}
        >
          <Copy className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={onShow} className="flex h-9 w-9 items-center justify-center rounded-full text-brand-strong hover:bg-surface-sunk" aria-label={`Show QR for ${t.label}`}>
          <QrCode className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </article>
  );
}

export default function TablesPage() {
  const { me, vendorsById } = usePanel();
  const q = useTables();
  const qc = useQueryClient();
  const [show, setShow] = useState<VendorTableRow | null>(null);
  const tables = q.data?.tables ?? [];
  const open = tables.filter((t) => t.openOrders > 0).length;

  return (
    <PanelPage
      title="Table View"
      subtitle={q.data ? `${tables.length} tables · ${open} with open orders` : undefined}
      actions={
        <PosSyncButton<TableSyncResponse>
          path="/v1/vendor/tables/sync"
          label="Sync tables from POS"
          what="sync its tables from the POS"
          onDone={(r) => {
            void qc.invalidateQueries({ queryKey: ["vendor", "tables"] });
            return `${r.posTables} POS tables · ${r.created} new${r.linked ? ` · ${r.linked} linked` : ""}`;
          }}
        />
      }
    >
      {q.isPending ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState title="Couldn't load tables" body={q.error.message} retry={() => void q.refetch()} />
      ) : tables.length === 0 ? (
        <EmptyState icon={<Armchair className="h-8 w-8" />} title="No tables yet" body="Sync tables from your POS, or ask qlub to generate table QRs." />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
          {tables.map((t) => (
            <TableCard key={t.id} t={t} onShow={() => setShow(t)} />
          ))}
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`QR for ${show.label}`} onClick={() => setShow(null)}>
          <div className="relative w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShow(null)} aria-label="Close" className="absolute -right-3 -top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card">
              <X className="h-5 w-5" aria-hidden />
            </button>
            <QrCard
              venueName={show.vendorId && vendorsById.get(show.vendorId) ? `${me.venue.name} · ${vendorsById.get(show.vendorId)!.name}` : me.venue.name}
              tableLabel={show.label}
              url={show.url}
            />
          </div>
        </div>
      )}
    </PanelPage>
  );
}
