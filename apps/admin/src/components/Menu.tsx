"use client";
import { cx } from "@/lib/cx";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type MenuItem = { label: string; icon?: ReactNode; onSelect: () => void };

/** Small dropdown anchored to its trigger. Closes on outside click, Escape or selection. */
export function Menu({
  trigger,
  items,
  label,
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: MenuItem[];
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className={cx("relative inline-flex", className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <ul role="menu" aria-label={label} className="absolute right-0 top-full z-30 mt-2 min-w-[200px] overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-card">
          {items.map((it) => (
            <li key={it.label} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-small text-ink hover:bg-paper"
              >
                {it.icon && <span className="text-ink-muted" aria-hidden>{it.icon}</span>}
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
