"use client";
import { QrCard } from "@one/ui";
import type { PrintTable } from "./PrintSheet";

export function QrGrid({ venueName, tables }: { venueName: string; tables: PrintTable[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {tables.map((t) => (
        <QrCard key={t.id} venueName={t.venueName ?? venueName} tableLabel={t.label} url={t.url} />
      ))}
    </div>
  );
}
