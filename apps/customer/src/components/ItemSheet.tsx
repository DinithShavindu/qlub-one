"use client";
import { useEffect, useId, useState } from "react";
import type { MenuItem, Vendor } from "@one/contracts";
import { Button, formatMoney, MoneyText, QtyStepper, Sheet, VendorBadge } from "@one/ui";
import { MAX_QTY } from "@/lib/cart-store";

const NOTE_MAX = 80;

export function ItemSheet({
  item,
  vendor,
  currency,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  vendor: Vendor | null;
  currency: string;
  onClose: () => void;
  onAdd: (item: MenuItem, qty: number, note: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const noteId = useId();

  useEffect(() => {
    setQty(1);
    setNote("");
  }, [item?.id]);

  return (
    <Sheet open={!!item} onClose={onClose} title={item?.name}>
      {item && (
        <div className="flex flex-col gap-4">
          {item.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- POS image hosts are arbitrary
            <img src={item.imageUrl} alt="" className="aspect-video w-full rounded-lg bg-surface-sunk object-cover" />
          )}
          {vendor && <VendorBadge vendor={vendor} size="sm" className="text-ink-soft" />}
          {item.description && <p className="text-body text-ink-soft">{item.description}</p>}
          <MoneyText minor={item.priceMinor} currency={currency} className="text-body font-semibold" />
          <div>
            <label htmlFor={noteId} className="text-small font-semibold">
              Note for the stall (optional)
            </label>
            <input
              id={noteId}
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              placeholder="e.g. no onions"
              className="mt-1 h-11 w-full rounded-md border border-line bg-surface px-3 text-body placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-brand-strong"
            />
            <p className="mt-1 text-right text-micro text-ink-muted tabular-nums">
              {note.length}/{NOTE_MAX}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <QtyStepper value={qty} onChange={setQty} min={1} max={MAX_QTY} />
            <Button size="lg" className="flex-1" onClick={() => onAdd(item, qty, note)}>
              Add · {formatMoney(item.priceMinor * qty, currency)}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
