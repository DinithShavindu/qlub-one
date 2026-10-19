"use client";
import { useEffect, useRef } from "react";
import { Printer } from "lucide-react";
import { Button, QrCard } from "@one/ui";
import type { TableWithUrl } from "@one/contracts";

const PER_PAGE = 12;

/** A4 sheets, 12 QR cards per page (3 × 4). Opens the print dialog once the QR SVGs have rendered. */
export function PrintSheet({ venueName, tables, autoPrint = true }: { venueName: string; tables: TableWithUrl[]; autoPrint?: boolean }) {
  const printed = useRef(false);
  useEffect(() => {
    if (!autoPrint || printed.current || !tables.length) return;
    printed.current = true;
    const t = setTimeout(() => window.print(), 1200);
    return () => clearTimeout(t);
  }, [autoPrint, tables.length]);

  const pages: TableWithUrl[][] = [];
  for (let i = 0; i < tables.length; i += PER_PAGE) pages.push(tables.slice(i, i + PER_PAGE));

  return (
    <div className="min-h-screen bg-surface-sunk print:bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-8 py-3">
        <p className="text-small text-ink-soft">
          <span className="font-semibold text-ink">{venueName}</span> · {tables.length} table QR codes · {pages.length} A4 page
          {pages.length === 1 ? "" : "s"} (12 per page)
        </p>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden /> Print
        </Button>
      </div>
      <div className="flex flex-col items-center gap-8 py-8 print:block print:p-0">
        {pages.map((page, i) => (
          <section
            key={i}
            aria-label={`Page ${i + 1}`}
            className="grid h-[275mm] w-[190mm] grid-cols-3 grid-rows-4 gap-[4mm] bg-white p-0 shadow-card break-after-page last:break-after-auto print:shadow-none"
          >
            {page.map((t) => (
              <QrCard
                key={t.id}
                venueName={venueName}
                tableLabel={t.label}
                url={t.url}
                className="justify-center gap-1 rounded-md p-2 [&>div:first-child]:max-w-[38mm]"
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
