"use client";
import { cx } from "@/lib/cx";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, Plus, QrCode, Receipt, Rocket, Search, Settings, Store } from "lucide-react";
import { useVenue } from "@/lib/queries";
import { useCurrentVenueId } from "./use-current-venue-id";
import { VenueSwitcher } from "./VenueSwitcher";

function Tab({ href, active, icon, children }: { href: string; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "-mb-px flex h-full items-center gap-2 whitespace-nowrap border-b-2 px-1 text-body transition",
        active ? "border-brand font-semibold text-brand" : "border-transparent text-ink-soft hover:text-ink",
      )}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </Link>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const venueId = useCurrentVenueId();
  const venue = useVenue(venueId);
  const [switcher, setSwitcher] = useState(false);
  const inVenue = !!venueId && !pathname.startsWith("/venues/new");
  const isDraft = venue.data?.venue.status === "draft";
  const single = venue.data?.venue.type === "restaurant";
  const icon = "h-[18px] w-[18px]";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSwitcher(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-surface">
      <div className="flex h-[78px] items-center gap-8 px-10">
        <nav className="flex h-full items-center gap-7 overflow-x-auto" aria-label="Section">
          {inVenue ? (
            <>
              <Tab href={`/venues/${venueId}`} active={pathname === `/venues/${venueId}`} icon={<LayoutDashboard className={icon} />}>
                Dashboard
              </Tab>
              <Tab href={`/venues/${venueId}/vendors`} active={pathname.endsWith("/vendors")} icon={<Store className={icon} />}>
                {single ? "Vendor" : "Vendors"}
              </Tab>
              <Tab href={`/venues/${venueId}/tables`} active={pathname.endsWith("/tables")} icon={<QrCode className={icon} />}>
                QR Manager
              </Tab>
              <Tab href={`/venues/${venueId}/settlements`} active={pathname.endsWith("/settlements")} icon={<Receipt className={icon} />}>
                Settlements
              </Tab>
              <Tab href={`/venues/${venueId}/settings`} active={pathname.endsWith("/settings")} icon={<Settings className={icon} />}>
                Settings
              </Tab>
              {isDraft && (
                <Tab href={`/venues/new?id=${venueId}`} active={false} icon={<Rocket className={icon} />}>
                  Continue setup
                </Tab>
              )}
            </>
          ) : (
            <>
              <Tab href="/venues" active={pathname === "/venues"} icon={<Building2 className={icon} />}>
                Venues
              </Tab>
              <Tab href="/qrs" active={pathname.startsWith("/qrs")} icon={<QrCode className={icon} />}>
                QR Manager
              </Tab>
              <Tab
                href="/onboard"
                active={pathname.startsWith("/onboard") || pathname.startsWith("/venues/new") || pathname.startsWith("/restaurants/new")}
                icon={<Plus className={icon} />}
              >
                Onboard
              </Tab>
            </>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSwitcher(true)}
            className="flex h-12 items-center gap-3 rounded-full border border-line pl-4 pr-2 text-body text-ink-soft transition hover:border-ink-muted"
          >
            <Search className="h-5 w-5" aria-hidden />
            <span className="max-w-[200px] truncate">{inVenue && venue.data ? venue.data.venue.name : "Search"}</span>
            <span className="flex gap-1" aria-hidden>
              <kbd className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-micro">⌘</kbd>
              <kbd className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-micro">K</kbd>
            </span>
          </button>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-muted/60 text-body font-semibold text-white" aria-label="Signed in as admin">
            A
          </span>
        </div>
      </div>
      <VenueSwitcher open={switcher} onClose={() => setSwitcher(false)} />
    </header>
  );
}
