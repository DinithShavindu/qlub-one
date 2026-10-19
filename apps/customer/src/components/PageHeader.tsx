"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageHeader({ title, backHref, backLabel }: { title: string; backHref?: string; backLabel?: string }) {
  return (
    <>
      <div className="qlub-pattern h-20" aria-hidden />
      <header className="sticky top-0 z-30 -mt-6 flex h-14 items-center gap-2 rounded-t-xl bg-paper px-2 pt-2">
        {backHref ? (
          <Link
            href={backHref}
            aria-label={backLabel ?? "Back"}
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-sunk focus-visible:ring-2 focus-visible:ring-brand-strong"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
        ) : (
          <span className="w-2" />
        )}
        <h1 className="text-body font-semibold">{title}</h1>
      </header>
    </>
  );
}
