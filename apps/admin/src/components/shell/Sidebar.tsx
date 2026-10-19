"use client";
import { cx } from "@/lib/cx";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LogOut, Plus, QrCode, Receipt } from "lucide-react";
import { apiFetch } from "@one/ui";
import { useCurrentVenueId } from "./use-current-venue-id";

function RailLink({ href, active, icon, children }: { href: string; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex flex-col items-center gap-1.5 px-1 py-3.5 text-[11px] font-semibold transition",
        active ? "bg-rail-active text-white" : "text-rail-fg hover:bg-rail-hover hover:text-white",
      )}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </Link>
  );
}

/** qlub mark: 3×3 dot grid. */
function Logo() {
  return (
    <span className="grid grid-cols-3 gap-[3px]" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={cx("h-[5px] w-[5px] rounded-full", i === 4 ? "bg-transparent" : "bg-brand")} />
      ))}
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const venueId = useCurrentVenueId();

  async function logout() {
    await apiFetch("/v1/admin/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  }

  return (
    <aside className="no-print sticky top-0 flex h-screen w-[88px] shrink-0 flex-col bg-rail">
      <Link href="/venues" className="flex h-[78px] items-center justify-center border-b border-white/5" aria-label="qlub Ops home">
        <Logo />
      </Link>
      <nav className="flex flex-col pt-4" aria-label="Main">
        <RailLink
          href="/venues"
          active={pathname.startsWith("/venues") && !pathname.startsWith("/venues/new") && !pathname.endsWith("/settlements")}
          icon={<Building2 className="h-5 w-5" />}
        >
          Places
        </RailLink>
        <RailLink
          href="/onboard"
          active={pathname.startsWith("/onboard") || pathname.startsWith("/venues/new") || pathname.startsWith("/restaurants/new")}
          icon={<Plus className="h-5 w-5" />}
        >
          Onboard
        </RailLink>
        <RailLink href="/qrs" active={pathname.startsWith("/qrs")} icon={<QrCode className="h-5 w-5" />}>
          QRs
        </RailLink>
        <RailLink
          href={venueId ? `/venues/${venueId}/settlements` : "/venues"}
          active={pathname.endsWith("/settlements")}
          icon={<Receipt className="h-5 w-5" />}
        >
          Payments
        </RailLink>
      </nav>
      <button
        type="button"
        onClick={logout}
        className="mt-auto flex flex-col items-center gap-1.5 px-1 py-4 text-[11px] font-semibold text-rail-fg transition hover:bg-rail-hover hover:text-white"
      >
        <LogOut className="h-5 w-5" aria-hidden />
        Log out
      </button>
    </aside>
  );
}
