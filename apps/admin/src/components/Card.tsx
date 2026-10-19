import { cx } from "@/lib/cx";
import type { ReactNode } from "react";


export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-lg border border-line bg-surface shadow-card", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          {title && <h2 className="font-display text-body font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
