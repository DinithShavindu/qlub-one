"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageHeader({ title, backHref, backLabel }: { title: string; backHref?: string; backLabel?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper/95 px-2 backdrop-blur">
      {backHref ? (
        <Link
          href={backHref}
          aria-label={backLabel ?? "Back"}
          className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-surface-sunk focus-visible:ring-2 focus-visible:ring-brand-strong"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
      ) : (
        <span className="w-2" />
      )}
      <h1 className="font-display text-h2 font-bold">{title}</h1>
    </header>
  );
}
