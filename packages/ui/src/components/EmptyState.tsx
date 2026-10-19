import type { ReactNode } from "react";
import { cn } from "../utils";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      {icon && <div className="mb-1 text-ink-muted" aria-hidden>{icon}</div>}
      <p className="text-body font-semibold text-ink">{title}</p>
      {body && <p className="max-w-sm text-small text-ink-muted">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
