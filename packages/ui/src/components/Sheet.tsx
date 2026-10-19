"use client";
import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../utils";

/** Bottom sheet (customer) or side sheet (admin). */
export function Sheet({
  open,
  onClose,
  title,
  side = "bottom",
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  side?: "bottom" | "right";
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 animate-fade-in bg-ink/40" onClick={onClose} />
      <div
        className={cn(
          "absolute bg-surface shadow-sheet",
          side === "bottom"
            ? "inset-x-0 bottom-0 mx-auto max-h-[90vh] max-w-customer animate-slide-up overflow-y-auto rounded-t-xl"
            : "inset-y-0 right-0 w-full max-w-md overflow-y-auto",
          className,
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-surface px-4 pb-2 pt-4">
          <div className="min-w-0 text-h2 font-display font-bold">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-surface-sunk"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="px-4 pb-6">{children}</div>
      </div>
    </div>
  );
}
