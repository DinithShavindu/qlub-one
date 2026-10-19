"use client";
import { cx } from "@/lib/cx";
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";


/** Centered dialog. `dismissable=false` hides the close button and ignores Escape/backdrop. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  dismissable = true,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  dismissable?: boolean;
  className?: string;
}) {
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissable, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={dismissable ? onClose : undefined} aria-hidden />
      <div className={cx("relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-surface shadow-sheet", className)}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <h2 id="modal-title" className="font-display text-h2 font-bold">
            {title}
          </h2>
          {dismissable && (
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-surface-sunk">
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
