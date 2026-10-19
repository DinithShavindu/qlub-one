"use client";
import { cx } from "@/lib/cx";
import Link from "next/link";
import type { ReactNode } from "react";
import { CircleX, Search } from "lucide-react";

/** White card holding filter pills on the left and primary actions on the right. */
export function FilterBar({ children, actions, className }: { children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx("mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-5", className)}>
      {children}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/** Filled brand pill for an applied filter. `clearHref`/`onClear` adds the ⓧ. */
export function FilterChip({
  icon,
  children,
  onClear,
  clearHref,
  clearLabel = "Clear filter",
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClear?: () => void;
  clearHref?: string;
  clearLabel?: string;
}) {
  const x = <CircleX className="h-5 w-5 fill-white text-brand" aria-hidden />;
  return (
    <span className="inline-flex h-12 items-center gap-2 rounded-full bg-brand pl-4 pr-3 text-body text-on-brand">
      {icon && <span aria-hidden>{icon}</span>}
      <span className="max-w-[260px] truncate">{children}</span>
      {clearHref ? (
        <Link href={clearHref} aria-label={clearLabel}>
          {x}
        </Link>
      ) : onClear ? (
        <button type="button" onClick={onClear} aria-label={clearLabel}>
          {x}
        </button>
      ) : null}
    </span>
  );
}

/** Outlined toggle pill (e.g. status filters). */
export function TogglePill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "h-12 rounded-full border px-5 text-body transition",
        active ? "border-brand bg-brand text-on-brand" : "border-line text-ink hover:border-ink-muted",
      )}
    >
      {children}
    </button>
  );
}

/** Outlined search pill. */
export function SearchPill({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="inline-flex h-12 items-center gap-2 rounded-full border border-line px-4 transition focus-within:border-brand hover:border-ink-muted">
      <Search className="h-5 w-5 text-ink-soft" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-40 bg-transparent text-body text-ink outline-none placeholder:text-ink"
      />
    </label>
  );
}

/** Pill-shaped native select, matches the search pills. */
export function SelectPill({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-full border border-line bg-surface px-5 text-body text-ink transition hover:border-ink-muted"
      >
        {children}
      </select>
    </>
  );
}
