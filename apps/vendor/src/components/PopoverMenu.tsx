"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface MenuEntry {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  hint?: ReactNode;
}

/** Small dropdown menu: 64px trigger, 64px rows, closes on outside tap / Escape. */
export function PopoverMenu({
  trigger,
  label,
  entries,
  align = "right",
  className,
}: {
  trigger: ReactNode;
  label: string;
  entries: MenuEntry[];
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cx("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex h-16 w-16 items-center justify-center rounded-md text-ink hover:bg-surface-sunk focus-visible:ring-2 focus-visible:ring-brand-strong"
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          className={cx(
            "absolute top-full z-40 mt-1 min-w-[240px] animate-fade-in overflow-hidden rounded-md border border-line bg-surface py-1 shadow-card",
            align === "right" ? "right-0" : "left-0",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {entries.map((e) => (
            <button
              key={e.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                e.onSelect();
              }}
              className={cx(
                "flex min-h-16 w-full items-center gap-3 px-4 text-left text-body font-semibold hover:bg-surface-sunk focus-visible:bg-surface-sunk",
                e.danger ? "text-brand-strong" : "text-ink",
              )}
            >
              {e.icon && <span aria-hidden>{e.icon}</span>}
              <span className="flex-1">
                {e.label}
                {e.hint && <span className="block text-small font-normal text-ink-muted">{e.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
