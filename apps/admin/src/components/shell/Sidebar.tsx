"use client";
import { cx } from "@/lib/cx";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, LogOut, Plus, QrCode, Receipt, Store } from "lucide-react";
import { apiFetch } from "@one/ui";
import { useVenue } from "@/lib/queries";
import { useCurrentVenueId } from "./use-current-venue-id";

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex items-center gap-3 rounded-md px-3 py-2 text-small font-semibold transition",
        active ? "bg-ink text-paper" : "text-ink-soft hover:bg-surface-sunk",
      )}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const venueId = useCurrentVenueId();
  const venue = useVenue(venueId);
  const inVenue = venueId && !pathname.startsWith("/venues/new");
  const isLive = venue.data?.venue.status === "live";

  async function logout() {
    await apiFetch("/v1/admin/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  }

  return (
    <aside className="no-print sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-4 py-6">
      <Link href="/venues" className="mb-8 px-3">
        <span className="block font-display text-h2 font-bold">qlub Ops</span>
        <span className="text-micro font-semibold uppercase text-ink-muted">One venue, one setup</span>
      </Link>
      <nav className="flex flex-col gap-1" aria-label="Main">
        <NavLink href="/venues" active={pathname === "/venues"} icon={<Building2 className="h-4 w-4" />}>
          Venues
        </NavLink>
        <NavLink href="/venues/new" active={pathname.startsWith("/venues/new")} icon={<Plus className="h-4 w-4" />}>
          New venue
        </NavLink>
      </nav>

      {inVenue && (
        <nav className="mt-8 flex flex-col gap-1" aria-label="Venue">
          <p className="mb-1 truncate px-3 text-micro font-semibold uppercase text-ink-muted">{venue.data?.venue.name ?? "Venue"}</p>
          {venue.data && !isLive && (
            <NavLink href={`/venues/new?id=${venueId}`} active={false} icon={<Plus className="h-4 w-4" />}>
              Continue setup
            </NavLink>
          )}
          <NavLink href={`/venues/${venueId}`} active={pathname === `/venues/${venueId}`} icon={<LayoutDashboard className="h-4 w-4" />}>
            Dashboard
          </NavLink>
          <NavLink href={`/venues/${venueId}/vendors`} active={pathname.endsWith("/vendors")} icon={<Store className="h-4 w-4" />}>
            Vendors
          </NavLink>
          <NavLink href={`/venues/${venueId}/tables`} active={pathname.endsWith("/tables")} icon={<QrCode className="h-4 w-4" />}>
            Tables &amp; QR
          </NavLink>
          <NavLink href={`/venues/${venueId}/settlements`} active={pathname.endsWith("/settlements")} icon={<Receipt className="h-4 w-4" />}>
            Settlements
          </NavLink>
        </nav>
      )}

      <button
        type="button"
        onClick={logout}
        className="mt-auto flex items-center gap-3 rounded-md px-3 py-2 text-small font-semibold text-ink-soft hover:bg-surface-sunk"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Log out
      </button>
    </aside>
  );
}
