import { cx } from "@/lib/cx";
import type { ReactNode } from "react";


export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2xl border border-line bg-surface", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          {title && <h2 className="font-display text-body font-bold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
