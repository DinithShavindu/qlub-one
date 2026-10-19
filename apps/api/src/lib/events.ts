import { EventEmitter } from "node:events";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { SseEvent } from "@one/contracts";

/**
 * In-process event bus. Channels:
 *   vendor:<vendorId>   → that vendor's KDS stream only
 *   order:<masterOrderId> → the guest's tracker
 *   venue:<venueId>     → admin (not streamed in MVP; dashboard polls)
 */
const bus = new EventEmitter();
bus.setMaxListeners(0);

type Payload<T extends SseEvent["type"]> = Extract<SseEvent, { type: T }>["data"];

export function publish<T extends SseEvent["type"]>(channels: string[], type: T, data: Payload<T>): void {
  const event = { type, at: new Date().toISOString(), data } as SseEvent;
  for (const ch of channels) bus.emit(ch, event);
}

export const channel = {
  vendor: (id: string) => `vendor:${id}`,
  order: (id: string) => `order:${id}`,
  venue: (id: string) => `venue:${id}`,
  /** Every vendor order of a venue — the venue manager's combined QSR board. */
  kds: (venueId: string) => `kds:${venueId}`,
};

/** Stream one bus channel as SSE with a 15s heartbeat. */
export function sseResponse(c: Context, ch: string) {
  c.header("X-Accel-Buffering", "no");
  c.header("Cache-Control", "no-cache, no-transform");
  return streamSSE(c, async (stream) => {
    let alive = true;
    const send = (e: SseEvent) => {
      if (alive) void stream.writeSSE({ event: e.type, data: JSON.stringify(e) }).catch(() => (alive = false));
    };
    bus.on(ch, send);
    // initial heartbeat so the client knows the stream is open even through proxies
    send({ type: "heartbeat", at: new Date().toISOString(), data: {} });
    const hb = setInterval(() => send({ type: "heartbeat", at: new Date().toISOString(), data: {} }), 15_000);
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        alive = false;
        resolve();
      });
    });
    clearInterval(hb);
    bus.off(ch, send);
  });
}
