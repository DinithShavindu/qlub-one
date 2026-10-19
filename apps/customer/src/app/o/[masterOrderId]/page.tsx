"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import type { OrderResponse, SseEvent, VendorOrder, VendorOrderStatus } from "@one/contracts";
import {
  ApiClientError,
  ConnectionDot,
  EmptyState,
  ErrorState,
  formatMoney,
  formatTime,
  playReadyChime,
  Skeleton,
  useEventStream,
  vibrate,
} from "@one/ui";
import { ReadyAlert } from "@/components/ReadyAlert";
import { failedCopy, VendorOrderCard } from "@/components/VendorOrderCard";
import { fetchOrder, GENERIC_ERROR, orderStreamUrl, qk } from "@/lib/api";

function seenKey(id: string) {
  return `ready-seen:${id}`;
}
function loadSeen(id: string): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(seenKey(id)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveSeen(id: string, s: Set<string>) {
  try {
    sessionStorage.setItem(seenKey(id), JSON.stringify([...s]));
  } catch {
    /* private mode */
  }
}

const SPOKEN: Partial<Record<VendorOrderStatus, string>> = {
  new: "order received",
  preparing: "preparing",
  collected: "collected",
};

function announce(vendorName: string, vo: VendorOrder): string {
  if (vo.status === "ready") return `${vendorName}: ready, code ${vo.pickupCode.replace(/-/g, "").split("").join(" ")}`;
  if (vo.status === "failed") return failedCopy(vendorName, vo);
  return `${vendorName}: ${SPOKEN[vo.status] ?? vo.status}`;
}

export default function TrackerPage({ params }: { params: { masterOrderId: string } }) {
  const { masterOrderId } = params;
  const qc = useQueryClient();
  const order = useQuery({ queryKey: qk.order(masterOrderId), queryFn: () => fetchOrder(masterOrderId) });
  const refetch = order.refetch;

  const onEvent = useCallback(
    (e: SseEvent) => {
      if (e.type === "heartbeat") return;
      let unknown = false;
      qc.setQueryData<OrderResponse>(qk.order(masterOrderId), (old) => {
        if (!old) return old;
        switch (e.type) {
          case "vendor_order.updated": {
            const { vendorOrderId, status, pickupCode } = e.data;
            if (!old.vendorOrders.some((v) => v.id === vendorOrderId)) {
              unknown = true;
              return old;
            }
            return {
              ...old,
              vendorOrders: old.vendorOrders.map((v) =>
                v.id === vendorOrderId
                  ? {
                      ...v,
                      status,
                      pickupCode,
                      updatedAt: e.at,
                      statusChangedAt: e.at,
                      readyAt: status === "ready" ? e.at : v.readyAt,
                      collectedAt: status === "collected" ? e.at : v.collectedAt,
                    }
                  : v,
              ),
            };
          }
          case "vendor_order.failed": {
            const { vendorOrderId, reason, refundedMinor } = e.data;
            unknown = !old.vendorOrders.some((v) => v.id === vendorOrderId);
            return {
              ...old,
              vendorOrders: old.vendorOrders.map((v) =>
                v.id === vendorOrderId ? { ...v, status: "failed", failureReason: reason, refundedMinor, updatedAt: e.at } : v,
              ),
            };
          }
          case "master_order.updated":
            return { ...old, masterOrder: { ...old.masterOrder, status: e.data.status } };
          default:
            return old;
        }
      });
      // a failure changes the master refund total — take the server's number
      if (unknown || e.type === "vendor_order.failed") void refetch();
    },
    [qc, masterOrderId, refetch],
  );

  const conn = useEventStream(order.isError ? null : orderStreamUrl(masterOrderId), {
    onEvent,
    onReconnect: () => void refetch(),
    onPoll: () => void refetch(),
  });

  const data = order.data;
  const vendorsById = useMemo(() => new Map((data?.vendors ?? []).map((v) => [v.id, v])), [data?.vendors]);

  /* ── ready moment (once per card) + live announcements ── */
  const [popping, setPopping] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const prevStatus = useRef<Map<string, VendorOrderStatus> | null>(null);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    seen.current ??= loadSeen(masterOrderId);
    const first = prevStatus.current === null;
    const prev = prevStatus.current ?? new Map<string, VendorOrderStatus>();
    const said: string[] = [];
    const newlyReady: string[] = [];
    for (const vo of data.vendorOrders) {
      const name = vendorsById.get(vo.vendorId)?.name ?? "A stall";
      if (!first && prev.get(vo.id) !== vo.status) said.push(announce(name, vo));
      if (vo.status === "ready" && !seen.current.has(vo.id)) {
        seen.current.add(vo.id);
        newlyReady.push(vo.id);
        if (first) said.push(announce(name, vo));
      }
      prev.set(vo.id, vo.status);
    }
    prevStatus.current = prev;
    if (newlyReady.length) {
      saveSeen(masterOrderId, seen.current);
      setPopping((s) => new Set([...s, ...newlyReady]));
      vibrate(200);
      playReadyChime();
    }
    if (said.length) setAnnouncement(said.join(". "));
  }, [data, vendorsById, masterOrderId]);

  /* ── states ── */
  if (order.isPending) {
    return (
      <main className="flex flex-col gap-4 px-4 pt-6" aria-busy="true" aria-label="Loading your order">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-32" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-lg" />
        ))}
      </main>
    );
  }
  if (order.isError) {
    const err = order.error;
    return (
      <main className="flex min-h-dvh items-center justify-center">
        {err instanceof ApiClientError && err.status === 404 ? (
          <EmptyState
            icon={<Receipt className="h-10 w-10" />}
            title="We couldn't find this order"
            body="Orders can only be opened on the phone that placed them."
          />
        ) : (
          <ErrorState body={GENERIC_ERROR} retry={() => void refetch()} />
        )}
      </main>
    );
  }

  if (!data) return null;
  const { masterOrder, vendorOrders } = data;
  const sorted = [...vendorOrders].sort(
    (a, b) => (vendorsById.get(a.vendorId)?.sortOrder ?? 0) - (vendorsById.get(b.vendorId)?.sortOrder ?? 0),
  );
  const paidFailed = masterOrder.status === "payment_failed" || masterOrder.status === "pending_payment";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-h2 font-bold">
            {paidFailed ? "Payment not completed" : `Order placed · paid ${formatMoney(masterOrder.totalMinor, masterOrder.currency)}`}
          </h1>
          <ConnectionDot state={conn} className="shrink-0" />
        </div>
        <p className="text-small text-ink-muted">
          {formatTime(masterOrder.createdAt)} · Table {masterOrder.tableLabel}
          {masterOrder.guestFirstName && ` · ${masterOrder.guestFirstName}`}
          {masterOrder.refundedMinor > 0 && ` · ${formatMoney(masterOrder.refundedMinor, masterOrder.currency)} refunded`}
        </p>
      </header>

      <main className="flex flex-col gap-4 px-4 pb-10 pt-4">
        <div className="flex justify-center">
          <ReadyAlert />
        </div>
        {sorted.length === 0 ? (
          <EmptyState title="Sending your order to the stalls…" body="This usually takes a second." />
        ) : (
          sorted.map((vo) => (
            <VendorOrderCard key={vo.id} vo={vo} vendor={vendorsById.get(vo.vendorId)} popping={popping.has(vo.id)} />
          ))
        )}

        <div aria-live="polite" role="status" className="sr-only">
          {announcement}
        </div>

        <footer className="mt-4 flex flex-col items-center gap-3 text-center">
          <p className="text-small text-ink-muted">Show this screen at the counter.</p>
          <Link
            href={`/v/${masterOrder.venueId}/menu`}
            className="inline-flex h-11 items-center rounded-md border border-line bg-surface px-5 font-semibold hover:bg-surface-sunk focus-visible:ring-2 focus-visible:ring-brand-strong"
          >
            Order more
          </Link>
        </footer>
      </main>
    </>
  );
}
