"use client";
import { cx } from "@/lib/cx";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Search } from "lucide-react";
import { useVenues } from "@/lib/queries";
import { VenueStatusPill } from "./VenueStatusPill";

/** ⌘K palette: jump to any venue. Live venues open the dashboard, drafts the wizard. */
export function VenueSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const venues = useVenues();
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
    }
  }, [open]);

  if (!open) return null;

  const needle = q.trim().toLowerCase();
  const list = (venues.data?.venues ?? [])
    .map((v) => v.venue)
    .filter((v) => !needle || v.name.toLowerCase().includes(needle) || v.code.toLowerCase().includes(needle));

  function go(i: number) {
    const v = list[i];
    if (!v) return;
    onClose();
    router.push(v.status === "live" ? `/venues/${v.id}` : `/venues/new?id=${v.id}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Switch venue">
      <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-sheet">
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search className="h-5 w-5 text-ink-muted" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, list.length - 1));
              if (e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
              if (e.key === "Enter") go(cursor);
            }}
            placeholder="Search venues by name or code…"
            aria-label="Search venues"
            className="h-14 flex-1 bg-transparent text-body outline-none placeholder:text-ink-muted"
          />
          <kbd className="rounded-md border border-line px-2 py-0.5 text-micro text-ink-muted">Esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2" role="listbox">
          {venues.isPending && <li className="px-5 py-3 text-small text-ink-muted">Loading venues…</li>}
          {venues.isError && <li className="px-5 py-3 text-small text-status-failed-fg">Couldn&apos;t load venues</li>}
          {venues.data && list.length === 0 && <li className="px-5 py-3 text-small text-ink-muted">No venues match “{q}”</li>}
          {list.map((v, i) => (
            <li key={v.id} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(i)}
                className={cx("flex w-full items-center gap-3 px-5 py-3 text-left", i === cursor && "bg-status-new")}
              >
                <Building2 className="h-5 w-5 text-ink-muted" aria-hidden />
                <span className="flex-1">
                  <span className="block font-semibold">{v.name}</span>
                  <span className="text-micro uppercase text-ink-muted">Code {v.code}</span>
                </span>
                <VenueStatusPill status={v.status} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
