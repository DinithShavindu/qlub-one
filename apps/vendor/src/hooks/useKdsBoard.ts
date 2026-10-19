"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { KdsStatus, SseEvent, VendorOrder, VendorOrdersResponse, VendorStatusRequest } from "@one/contracts";
import { ApiClientError, apiFetch, playNewOrderBeeps, STATUS_LABEL, useEventStream, useToast } from "@one/ui";
import { BOARD_STATUSES, byCreatedAt, FRESH_PULSE_MS, isBoardStatus, type BoardStatus } from "@/lib/kds";
import { qk, STREAM_PATH, useOrdersQuery } from "@/lib/queries";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2500;
/** Stretch: re-beep every 30s while an order waits in New for more than 2 min. */
const NAG_INTERVAL_MS = 30_000;
const NAG_AFTER_MS = 120_000;

interface Options {
  soundOn: boolean;
  announce: (msg: string) => void;
}

/**
 * KDS state: REST snapshot (TanStack Query) kept live by the vendor SSE stream,
 * with poll fallback, optimistic status moves, retry + undo.
 */
export function useKdsBoard({ soundOn, announce }: Options) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const query = useOrdersQuery(true);

  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const announceRef = useRef(announce);
  announceRef.current = announce;

  /** orderId → mutation sequence; SSE echoes for an order with a mutation in flight are ignored. */
  const pending = useRef(new Map<string, number>());
  const seq = useRef(0);

  /* ── cache helpers ── */

  const getOrders = useCallback(() => qc.getQueryData<VendorOrdersResponse>(qk.orders), [qc]);

  /** Insert/replace an order in the board cache; non-board statuses remove it. */
  const upsert = useCallback(
    (o: VendorOrder) => {
      qc.setQueryData<VendorOrdersResponse>(qk.orders, (old) => {
        if (!old) return old;
        const rest = old.vendorOrders.filter((x) => x.id !== o.id);
        return { ...old, vendorOrders: isBoardStatus(o.status) ? [...rest, o].sort(byCreatedAt) : rest };
      });
    },
    [qc],
  );

  const refetch = useCallback(() => {
    void qc.invalidateQueries({ queryKey: qk.orders });
  }, [qc]);

  /* ── SSE ── */

  const onEvent = useCallback(
    (e: SseEvent) => {
      switch (e.type) {
        case "vendor_order.created": {
          const cur = getOrders();
          if (!cur) return refetch();
          if (!isBoardStatus(e.data.status) || cur.vendorOrders.some((o) => o.id === e.data.id)) return;
          qc.setQueryData<VendorOrdersResponse>(qk.orders, {
            vendorOrders: [...cur.vendorOrders, e.data].sort(byCreatedAt),
            todayCount: cur.todayCount + 1,
          });
          return;
        }
        case "vendor_order.updated": {
          const { vendorOrderId, status } = e.data;
          if (pending.current.has(vendorOrderId)) return; // our own move — the POST result wins
          const cur = getOrders();
          const existing = cur?.vendorOrders.find((o) => o.id === vendorOrderId);
          if (!existing) {
            // e.g. an order moved back from Collected on another screen, or one we haven't loaded yet
            if (isBoardStatus(status)) refetch();
            return;
          }
          if (existing.status !== status) {
            upsert({ ...existing, status, previousStatus: existing.status, statusChangedAt: e.at });
            announceRef.current(`Order ${e.data.pickupCode} is now ${STATUS_LABEL[status]}`);
          }
          // get the authoritative undo window etc.
          if (pending.current.size === 0) refetch();
          return;
        }
        case "vendor_order.failed": {
          const cur = getOrders();
          const existing = cur?.vendorOrders.find((o) => o.id === e.data.vendorOrderId);
          if (existing) upsert({ ...existing, status: "failed" });
          return;
        }
        default:
          return;
      }
    },
    [getOrders, qc, refetch, upsert],
  );

  const connection = useEventStream(STREAM_PATH, { onEvent, onReconnect: refetch, onPoll: refetch });

  /* ── arrival detection (works for SSE, poll and reconnect refetch alike) ── */

  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Record<string, number>>({});
  const [unacked, setUnacked] = useState(0);

  useEffect(() => {
    const data = query.data;
    if (!data) return;
    if (seen.current === null) {
      seen.current = new Set(data.vendorOrders.map((o) => o.id));
      return;
    }
    const arrivals = data.vendorOrders.filter((o) => !seen.current!.has(o.id));
    for (const o of arrivals) seen.current.add(o.id);
    const newOnes = arrivals.filter((o) => o.status === "new");
    if (newOnes.length === 0) return;
    const now = Date.now();
    setFresh((f) => ({ ...f, ...Object.fromEntries(newOnes.map((o) => [o.id, now])) }));
    setUnacked((n) => n + newOnes.length);
    if (soundRef.current) playNewOrderBeeps();
    announceRef.current(
      newOnes.length === 1
        ? `New order ${newOnes[0].pickupCode}${newOnes[0].guestFirstName ? ` for ${newOnes[0].guestFirstName}` : ""}, table ${newOnes[0].tableLabel}`
        : `${newOnes.length} new orders`,
    );
  }, [query.data]);

  // pulsing border lasts 10s
  useEffect(() => {
    const ids = Object.keys(fresh);
    if (ids.length === 0) return;
    const nextExpiry = Math.min(...ids.map((id) => fresh[id])) + FRESH_PULSE_MS;
    const t = setTimeout(
      () => {
        const now = Date.now();
        setFresh((f) => Object.fromEntries(Object.entries(f).filter(([, at]) => now - at < FRESH_PULSE_MS)));
      },
      Math.max(0, nextExpiry - Date.now()) + 20,
    );
    return () => clearTimeout(t);
  }, [fresh]);

  // stretch: nag while something waits in New > 2 min
  useEffect(() => {
    const t = setInterval(() => {
      if (!soundRef.current) return;
      const orders = getOrders()?.vendorOrders ?? [];
      const now = Date.now();
      if (orders.some((o) => o.status === "new" && now - new Date(o.createdAt).getTime() > NAG_AFTER_MS)) playNewOrderBeeps();
    }, NAG_INTERVAL_MS);
    return () => clearInterval(t);
  }, [getOrders]);

  const acknowledge = useCallback(() => setUnacked(0), []);

  /* ── status moves ── */

  const move = useCallback(
    async (order: VendorOrder, to: KdsStatus, opts: { undo?: boolean; attempt?: number } = {}): Promise<void> => {
      const attempt = opts.attempt ?? 0;
      const from = order.status;
      const id = ++seq.current;
      pending.current.set(order.id, id);
      await qc.cancelQueries({ queryKey: qk.orders });

      upsert({ ...order, status: to, previousStatus: opts.undo ? null : from, statusChangedAt: new Date().toISOString() });
      announceRef.current(`Order ${order.pickupCode} moved to ${STATUS_LABEL[to]}`);

      const settle = () => {
        if (pending.current.get(order.id) === id) pending.current.delete(order.id);
      };

      try {
        const body: VendorStatusRequest = { status: to };
        const updated = await apiFetch<VendorOrder>(`/v1/vendor/orders/${encodeURIComponent(order.id)}/status`, {
          method: "POST",
          json: body,
        });
        settle();
        upsert(updated);
        if (to === "collected" || from === "collected") void qc.invalidateQueries({ queryKey: qk.history });
        if (!opts.undo) {
          toast({
            title: to === "collected" ? `${order.pickupCode} collected` : `${order.pickupCode} moved to ${STATUS_LABEL[to]}`,
            variant: "success",
            durationMs: 5000,
            action: { label: "Undo", onClick: () => void move(updated, from as KdsStatus, { undo: true }) },
          });
        } else {
          toast({ title: `${order.pickupCode} moved back to ${STATUS_LABEL[to]}`, variant: "info", durationMs: 2500 });
        }
      } catch (e) {
        settle();
        upsert(order); // revert
        if (e instanceof ApiClientError && e.status === 401) return; // redirected to login
        if (e instanceof ApiClientError && e.status >= 400 && e.status < 500) {
          // 409 INVALID_STATUS_TRANSITION / CONFLICT: someone else changed it, or the undo window passed
          toast({ title: e.message || "Couldn't update this order", variant: "error", durationMs: 4000 });
          refetch();
          return;
        }
        if (attempt >= MAX_RETRIES) {
          toast({ title: "Couldn't update — check the connection and try again", variant: "error", durationMs: 5000 });
          refetch();
          return;
        }
        toast({ title: "Couldn't update — retrying", variant: "error", durationMs: RETRY_DELAY_MS });
        setTimeout(() => {
          // only retry if nothing else moved the order in the meantime
          const cur = getOrders()?.vendorOrders.find((o) => o.id === order.id);
          const unchanged = from === "collected" ? !cur : cur?.status === from;
          if (unchanged) void move(cur ?? order, to, { ...opts, attempt: attempt + 1 });
        }, RETRY_DELAY_MS * (attempt + 1));
      }
    },
    [getOrders, qc, refetch, toast, upsert],
  );

  /* ── derived ── */

  const columns = useMemo(() => {
    const out: Record<BoardStatus, VendorOrder[]> = { new: [], preparing: [], ready: [] };
    for (const o of query.data?.vendorOrders ?? []) if (isBoardStatus(o.status)) out[o.status].push(o);
    for (const s of BOARD_STATUSES) out[s].sort(byCreatedAt);
    return out;
  }, [query.data]);

  return {
    query,
    columns,
    todayCount: query.data?.todayCount ?? 0,
    connection,
    fresh,
    unacked,
    acknowledge,
    move,
    refetch,
  };
}
