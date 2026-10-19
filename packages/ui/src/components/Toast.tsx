"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { cn } from "../utils";

export type ToastVariant = "info" | "success" | "error";
export interface ToastInput {
  title: string;
  variant?: ToastVariant;
  durationMs?: number;
  action?: { label: string; onClick: () => void };
}
interface ToastItem extends ToastInput {
  id: number;
}

const Ctx = createContext<{ toast: (t: ToastInput) => number; dismiss: (id: number) => void } | null>(null);

const STYLE: Record<ToastVariant, { cls: string; Icon: typeof Info }> = {
  info: { cls: "bg-ink text-paper", Icon: Info },
  success: { cls: "bg-ink text-paper", Icon: CheckCircle },
  error: { cls: "bg-status-failed text-status-failed-fg border border-status-failed-fg/30", Icon: AlertTriangle },
};

export function ToastProvider({ children, position = "bottom" }: { children: ReactNode; position?: "bottom" | "top" }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      setTimeout(() => dismiss(id), t.durationMs ?? 2500);
      return id;
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 z-[60] mx-auto flex max-w-customer flex-col gap-2 px-4",
          position === "bottom" ? "bottom-24" : "top-4",
        )}
        aria-live="polite"
      >
        {items.map((t) => {
          const { cls, Icon } = STYLE[t.variant ?? "info"];
          return (
            <div key={t.id} className={cn("pointer-events-auto flex animate-slide-in-top items-center gap-3 rounded-md px-4 py-3 shadow-card", cls)}>
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className="flex-1 text-small font-semibold">{t.title}</span>
              {t.action && (
                <button
                  type="button"
                  className="rounded-sm px-2 py-1 text-small font-bold underline underline-offset-2"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button type="button" aria-label="Dismiss" className="rounded-sm p-1 opacity-80 hover:opacity-100" onClick={() => dismiss(t.id)}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
