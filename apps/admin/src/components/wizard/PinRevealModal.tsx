"use client";
import { useState } from "react";
import { AlertTriangle, Copy } from "lucide-react";
import { Button, useToast } from "@one/ui";
import { Modal } from "@/components/Modal";

export interface PinRow {
  vendorId: string;
  name: string;
  pin: string;
}

/** Generated PINs, shown exactly once. Must be acknowledged; there is no way to see them again. */
export function PinRevealModal({
  pins,
  venueCode,
  onDone,
  doneLabel = "I've saved these PINs",
}: {
  pins: PinRow[] | null;
  venueCode: string;
  onDone: () => void;
  doneLabel?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  if (!pins) return null;

  async function copyAll() {
    const text = [`Venue code: ${venueCode}`, ...pins!.map((p) => `${p.name}: ${p.pin}`)].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "PINs copied to clipboard", variant: "success" });
    } catch {
      toast({ title: "Couldn't copy — select and copy the PINs manually", variant: "error" });
    }
  }

  return (
    <Modal
      open
      onClose={onDone}
      dismissable={false}
      title={pins.length === 1 ? "New vendor PIN" : `${pins.length} vendor PINs`}
      footer={
        <>
          <Button variant="secondary" onClick={copyAll}>
            <Copy className="h-4 w-4" aria-hidden /> {copied ? "Copied" : "Copy all"}
          </Button>
          <Button onClick={onDone}>{doneLabel}</Button>
        </>
      }
    >
      <div role="alert" className="mb-4 flex items-start gap-3 rounded-md bg-status-failed px-4 py-3 text-small font-semibold text-status-failed-fg">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        PINs won&apos;t be shown again. Copy them now and hand each one to its vendor.
      </div>
      <p className="mb-3 text-small text-ink-soft">
        Vendors log in on the kitchen screen with venue code <span className="font-display font-bold text-ink">{venueCode}</span> and their PIN.
      </p>
      <ul className="divide-y divide-line rounded-md border border-line">
        {pins.map((p) => (
          <li key={p.vendorId} className="flex items-center justify-between px-4 py-3">
            <span className="font-semibold">{p.name}</span>
            <span className="select-all font-display text-h2 font-bold tabular-nums tracking-widest">{p.pin}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
