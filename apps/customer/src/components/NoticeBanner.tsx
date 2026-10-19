"use client";
import { AlertTriangle, X } from "lucide-react";

export function NoticeBanner({ messages, onDismiss }: { messages: string[]; onDismiss: () => void }) {
  if (!messages.length) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-status-failed-fg/30 bg-status-failed p-3 text-status-failed-fg">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-small">
        <p className="font-semibold">We updated your cart</p>
        <ul className="mt-1 space-y-0.5">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-status-failed-fg/10"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
