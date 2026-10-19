import Link from "next/link";
import type { ReactNode } from "react";
import { CirclePlus } from "lucide-react";

const addCls = "flex h-9 w-9 items-center justify-center rounded-full text-brand transition hover:bg-status-new";

/** Bold title with an optional round "+" add action (qlub admin pattern). */
export function PageHeader({
  title,
  subtitle,
  actions,
  addHref,
  onAdd,
  addLabel = "Add",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  addHref?: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  const plus = <CirclePlus className="h-8 w-8" strokeWidth={1.75} aria-hidden />;
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-4">
          <h1 className="text-[32px] font-bold leading-10 tracking-tight">{title}</h1>
          {addHref ? (
            <Link href={addHref} className={addCls} aria-label={addLabel} title={addLabel}>
              {plus}
            </Link>
          ) : onAdd ? (
            <button type="button" onClick={onAdd} className={addCls} aria-label={addLabel} title={addLabel}>
              {plus}
            </button>
          ) : null}
        </div>
        {subtitle && <p className="mt-1 text-small text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
