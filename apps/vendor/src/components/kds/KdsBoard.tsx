"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { VendorMeResponse, VendorOrder } from "@one/contracts";
import { ErrorState, isAudioUnlocked, Skeleton } from "@one/ui";
import { cx } from "@/lib/cx";
import { useKdsBoard } from "@/hooks/useKdsBoard";
import { useNow } from "@/hooks/useNow";
import { useOnline } from "@/hooks/useOnline";
import { useTitleFlash } from "@/hooks/useTitleFlash";
import { BOARD_STATUSES, COLUMN_META, type BoardStatus } from "@/lib/kds";
import { usePrefs } from "@/lib/prefs";
import { KdsColumn } from "./KdsColumn";
import { KdsTopBar } from "./KdsTopBar";
import { OfflineBanner } from "./OfflineBanner";
import { OrderDetailDrawer } from "./OrderDetailDrawer";
import { SoundUnlockOverlay } from "./SoundUnlockOverlay";

export function KdsBoard({ me }: { me: VendorMeResponse }) {
  const { soundOn, setSoundOn } = usePrefs();
  const now = useNow(1000);
  const online = useOnline();

  // aria-live announcements (a trailing toggle char forces repeats to be re-read)
  const [announcement, setAnnouncement] = useState("");
  const announce = useCallback((msg: string) => setAnnouncement((prev) => (prev === msg ? `${msg}​` : msg)), []);

  const board = useKdsBoard({ soundOn, announce });
  const { columns, connection, fresh, unacked, acknowledge, move, query } = board;

  useTitleFlash(unacked > 0 ? `(${unacked}) New order` : null, `${me.vendor.name} · Kitchen`);

  // any tap/key on the board acknowledges new orders → stop the title flashing
  useEffect(() => {
    if (unacked === 0) return;
    const ack = () => document.visibilityState === "visible" && acknowledge();
    window.addEventListener("pointerdown", ack);
    window.addEventListener("keydown", ack);
    return () => {
      window.removeEventListener("pointerdown", ack);
      window.removeEventListener("keydown", ack);
    };
  }, [unacked, acknowledge]);

  // sound unlock overlay
  const [needsUnlock, setNeedsUnlock] = useState(false);
  useEffect(() => {
    setNeedsUnlock(soundOn && !isAudioUnlocked());
  }, [soundOn]);

  // detail drawer shows the live version of the order
  const [openId, setOpenId] = useState<string | null>(null);
  const openOrder = useMemo(
    () => (openId ? BOARD_STATUSES.flatMap((s) => columns[s]).find((o) => o.id === openId) ?? null : null),
    [openId, columns],
  );
  const onOpen = useCallback((o: VendorOrder) => setOpenId(o.id), []);
  const onMove = useCallback(
    (o: VendorOrder, to: Parameters<typeof move>[1], opts?: { undo?: boolean }) => void move(o, to, opts),
    [move],
  );

  // phone portrait: one column at a time, tabs with counts
  const [tab, setTab] = useState<BoardStatus>("new");

  const offline = !online || connection === "offline";

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <KdsTopBar me={me} now={now} connection={connection} todayCount={board.todayCount} />
      {offline && <OfflineBanner />}

      {query.isPending ? (
        <BoardSkeleton />
      ) : query.isError && !query.data ? (
        <div className="flex flex-1 items-center justify-center">
          <ErrorState title="Couldn't load orders" retry={() => void query.refetch()} />
        </div>
      ) : (
        <>
          {/* tabs: phone portrait only */}
          <div role="tablist" aria-label="Order status" className="grid shrink-0 grid-cols-3 gap-2 px-3 pt-3 md:hidden">
            {BOARD_STATUSES.map((s) => (
              <button
                key={s}
                role="tab"
                type="button"
                aria-selected={tab === s}
                aria-controls={`panel-${s}`}
                onClick={() => setTab(s)}
                className={cx(
                  "flex h-16 flex-col items-center justify-center rounded-md border-2 font-display font-bold leading-tight",
                  tab === s ? cx(COLUMN_META[s].header, "border-transparent") : "border-line text-ink-soft",
                )}
              >
                <span className="text-body">{COLUMN_META[s].title}</span>
                <span className="text-h2 tabular-nums">{columns[s].length}</span>
              </button>
            ))}
          </div>
          <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-3 pt-3 md:grid-cols-3 md:px-4">
            {BOARD_STATUSES.map((s) => (
              <KdsColumn
                key={s}
                status={s}
                orders={columns[s]}
                now={now}
                fresh={fresh}
                onMove={onMove}
                onOpen={onOpen}
                className={cx(tab === s ? "flex" : "hidden", "md:flex")}
              />
            ))}
          </main>
        </>
      )}

      <OrderDetailDrawer order={openOrder} now={now} timezone={me.venue.timezone} onClose={() => setOpenId(null)} onMove={onMove} />

      {needsUnlock && (
        <SoundUnlockOverlay
          onDone={() => setNeedsUnlock(false)}
          onMute={() => {
            setSoundOn(false);
            setNeedsUnlock(false);
          }}
        />
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid flex-1 grid-cols-1 gap-4 p-4 md:grid-cols-3" aria-busy="true" aria-label="Loading orders">
      {BOARD_STATUSES.map((s) => (
        <div key={s} className={cx("flex-col gap-3", s === "new" ? "flex" : "hidden md:flex")}>
          <Skeleton className="h-14" />
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
