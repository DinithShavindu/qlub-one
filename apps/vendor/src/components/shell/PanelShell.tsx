"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  ShoppingBag,
  Sun,
  UserRound,
  Utensils,
  Armchair,
} from "lucide-react";
import { useLogout } from "@/hooks/useLogout";
import { cx } from "@/lib/cx";
import { usePanel } from "@/lib/panel";
import { usePrefs } from "@/lib/prefs";
import { PopoverMenu } from "../PopoverMenu";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/orders", label: "Orders", Icon: ShoppingBag },
  { href: "/payments", label: "Payments", Icon: CreditCard },
  { href: "/tables", label: "Table View", Icon: Armchair },
  { href: "/qsr", label: "QSR Orders", Icon: Utensils },
  { href: "/menu", label: "Menu", Icon: BookOpen },
  { href: "/reports", label: "Reports", Icon: FileBarChart },
] as const;

function RailLink({ href, label, Icon, active }: { href: string; label: string; Icon: typeof LayoutDashboard; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex flex-col items-center gap-1.5 px-1 py-3.5 text-center text-[11px] font-semibold leading-tight transition",
        active ? "bg-rail-active text-white" : "text-rail-fg hover:bg-rail-hover hover:text-white",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
      {label}
    </Link>
  );
}

/** qlub mark: 3×3 dot grid, same as the admin rail. */
function Logo() {
  return (
    <span className="grid grid-cols-3 gap-[3px]" aria-label="qlub">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className={cx("h-[5px] w-[5px] rounded-full", i === 4 ? "bg-transparent" : "bg-brand")} />
      ))}
    </span>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-dvh w-[88px] shrink-0 flex-col bg-rail">
      <Link href="/dashboard" className="flex h-[74px] shrink-0 items-center justify-center border-b border-white/5" aria-label="Dashboard">
        <Logo />
      </Link>
      <nav className="flex flex-1 flex-col overflow-y-auto pt-4" aria-label="Main">
        {NAV.map((n) => (
          <RailLink key={n.href} {...n} active={pathname.startsWith(n.href)} />
        ))}
      </nav>
      <div className="border-t border-white/5">
        <RailLink href="/settings" label="Settings" Icon={Settings} active={pathname.startsWith("/settings")} />
      </div>
    </aside>
  );
}

/** Manager-only: narrows every page to one vendor of the venue. */
function VendorFilter() {
  const { me, isManager, vendorId, setVendorId } = usePanel();
  if (!isManager) {
    return (
      <span className="inline-flex min-w-0 items-center gap-2 text-body font-semibold">
        <span aria-hidden>{me.vendor!.emoji}</span>
        <span className="truncate">{me.vendor!.name}</span>
        {me.venue.type !== "restaurant" && <span className="hidden truncate font-normal text-ink-muted md:inline">· {me.venue.name}</span>}
      </span>
    );
  }
  return (
    <label className="relative inline-flex h-11 items-center gap-2 rounded-full border border-line pl-4 pr-9 text-body transition focus-within:border-brand hover:border-ink-muted">
      <span className="text-ink-muted">Vendor:</span>
      <select
        value={vendorId}
        onChange={(e) => setVendorId(e.target.value)}
        aria-label="Vendor"
        className="max-w-[220px] appearance-none bg-transparent font-semibold text-ink outline-none"
      >
        <option value="">All vendors ({me.vendors.length})</option>
        {me.vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.emoji} {v.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-ink-soft" aria-hidden />
    </label>
  );
}

function TopBar() {
  const { me, isManager } = usePanel();
  const router = useRouter();
  const logout = useLogout();
  const { theme, setTheme } = usePrefs();
  const who = isManager ? "Venue manager" : me.vendor!.name;
  return (
    <header className="sticky top-0 z-30 flex h-[74px] shrink-0 items-center gap-4 border-b border-line bg-surface px-6">
      <VendorFilter />
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-right leading-tight sm:block">
          <span className="block text-small font-semibold">{who}</span>
          <span className="block text-micro text-ink-muted">
            {me.venue.name} · <span className="font-mono">{me.venue.code}</span>
          </span>
        </span>
        <PopoverMenu
          label="Account"
          trigger={
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunk text-ink">
              <UserRound className="h-6 w-6" aria-hidden />
            </span>
          }
          entries={[
            {
              key: "theme",
              label: theme === "dark" ? "Light mode" : "Dark mode",
              icon: theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />,
              onSelect: () => setTheme(theme === "dark" ? "light" : "dark"),
            },
            { key: "settings", label: "Settings", icon: <Settings className="h-5 w-5" />, onSelect: () => router.push("/settings") },
            { key: "logout", label: "Log out", icon: <LogOut className="h-5 w-5" />, danger: true, onSelect: () => void logout() },
          ]}
        />
      </div>
    </header>
  );
}

export function PanelShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-paper">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

/** Standard page body: title row + content. */
export function PanelPage({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex flex-col gap-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-small text-ink-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {children}
    </main>
  );
}
