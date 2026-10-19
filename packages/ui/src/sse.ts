"use client";
import { useEffect, useRef, useState } from "react";
import { SSE_EVENT_TYPES, type SseEvent } from "@one/contracts";
import type { ConnectionState } from "./components/ConnectionDot";

/**
 * Subscribe to an api SSE stream. Calls `onReconnect` whenever the stream (re)opens after a drop
 * so the caller can refetch the REST resource (events are not replayed).
 * If the stream keeps failing, state goes "offline" and `onPoll` is called every `pollMs`.
 */
export function useEventStream(
  url: string | null,
  handlers: { onEvent: (e: SseEvent) => void; onReconnect?: () => void; onPoll?: () => void },
  opts: { pollMs?: number } = {},
): ConnectionState {
  const [state, setState] = useState<ConnectionState>("reconnecting");
  const ref = useRef(handlers);
  ref.current = handlers;
  const pollMs = opts.pollMs ?? 5000;

  useEffect(() => {
    if (!url) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      setState("offline");
      const t = setInterval(() => ref.current.onPoll?.(), pollMs);
      return () => clearInterval(t);
    }
    let es: EventSource | null = null;
    let failures = 0;
    let opened = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const startPolling = () => {
      if (!poll) poll = setInterval(() => ref.current.onPoll?.(), pollMs);
    };
    const stopPolling = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };

    const connect = () => {
      if (closed) return;
      es = new EventSource(url, { withCredentials: true });
      es.onopen = () => {
        failures = 0;
        setState("live");
        stopPolling();
        if (opened) ref.current.onReconnect?.();
        opened = true;
      };
      const onMessage = (msg: MessageEvent) => {
        try {
          ref.current.onEvent(JSON.parse(msg.data) as SseEvent);
        } catch {
          /* ignore malformed */
        }
      };
      for (const t of SSE_EVENT_TYPES) es.addEventListener(t, onMessage as EventListener);
      es.onerror = () => {
        es?.close();
        failures += 1;
        setState(failures >= 3 ? "offline" : "reconnecting");
        if (failures >= 2) startPolling();
        opened = true; // next successful open counts as reconnect → refetch
        retry = setTimeout(connect, Math.min(1000 * 2 ** (failures - 1), 10_000));
      };
    };
    connect();

    const onOnline = () => {
      if (retry) clearTimeout(retry);
      es?.close();
      connect();
    };
    window.addEventListener("online", onOnline);
    return () => {
      closed = true;
      es?.close();
      stopPolling();
      if (retry) clearTimeout(retry);
      window.removeEventListener("online", onOnline);
    };
  }, [url, pollMs]);

  return state;
}
