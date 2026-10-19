import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Hotel, Store, UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

function Choice({ href, icon, title, body, points }: { href: string; icon: ReactNode; title: string; body: string; points: string[] }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface p-7 transition hover:border-brand hover:shadow-card focus-visible:border-brand"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-status-new text-brand" aria-hidden>
        {icon}
      </span>
      <span>
        <span className="block text-h2 font-bold">{title}</span>
        <span className="mt-1 block text-body text-ink-soft">{body}</span>
      </span>
      <ul className="flex flex-col gap-1.5 text-small text-ink-soft">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="text-brand" aria-hidden>
              •
            </span>
            {p}
          </li>
        ))}
      </ul>
      <span className="mt-auto inline-flex items-center gap-1 font-semibold text-brand">
        Start <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

export default function OnboardPage() {
  return (
    <>
      <PageHeader title="Onboard" subtitle="Pick what you're setting up. Payment gateway, commission and flow can be changed later in Settings." />
      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        <Choice
          href="/restaurants/new"
          icon={<UtensilsCrossed className="h-7 w-7" />}
          title="Restaurant"
          body="A single venue — one restaurant, its POS, its QRs."
          points={["One form, live in about a minute", "Menu synced from the POS (or tablet starter menu)", "Table QRs generated for you"]}
        />
        <Choice
          href="/venues/new"
          icon={
            <span className="flex">
              <Store className="h-7 w-7" />
              <Hotel className="-ml-1 h-7 w-7" />
            </span>
          }
          title="Food court / Hotel"
          body="A multivendor venue — a set of restaurants working together."
          points={["Add many vendors at once (POS directory or paste a list)", "One QR per seat reaches every vendor", "One payment, split per vendor"]}
        />
      </div>
    </>
  );
}
