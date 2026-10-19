import { QrCode } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface shadow-card">
        <QrCode className="h-10 w-10 text-brand-strong" aria-hidden />
      </div>
      <h1 className="font-display text-h1 font-bold">Scan the QR on your table</h1>
      <p className="max-w-xs text-body text-ink-soft">
        Order from every stall in one basket, pay once, and we&apos;ll tell you when each part is ready.
      </p>
    </main>
  );
}
