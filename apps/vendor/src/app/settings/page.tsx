"use client";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Moon, Sun, UtensilsCrossed, Volume2 } from "lucide-react";
import type { AvailabilityRequest, MenuItem, VendorItemsResponse, VendorMeResponse } from "@one/contracts";
import {
  ApiClientError,
  apiFetch,
  EmptyState,
  ErrorState,
  MoneyText,
  playNewOrderBeeps,
  Skeleton,
  unlockAudio,
  useToast,
} from "@one/ui";
import { AppButton } from "@/components/AppButton";
import { AuthGate } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { Toggle } from "@/components/Toggle";
import { useLogout } from "@/hooks/useLogout";
import { usePrefs, type Theme } from "@/lib/prefs";
import { qk, useItems } from "@/lib/queries";
import { cx } from "@/lib/cx";

export default function SettingsPage() {
  return <AuthGate>{(me) => <Settings me={me} />}</AuthGate>;
}

function Settings({ me }: { me: VendorMeResponse }) {
  const { soundOn, setSoundOn, theme, setTheme } = usePrefs();
  const logout = useLogout();
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <div className="min-h-dvh">
      <PageHeader me={me} title="Settings" />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
        <Card title="Sound">
          <Row label="New order sound" hint="Two short beeps when an order arrives">
            <Toggle checked={soundOn} onChange={setSoundOn} label="New order sound" />
          </Row>
          <Row label="Test sound" hint="Check the tablet volume">
            <AppButton
              size="xl"
              variant="secondary"
              onClick={async () => {
                await unlockAudio();
                playNewOrderBeeps();
              }}
            >
              <Volume2 className="h-6 w-6" aria-hidden />
              Play
            </AppButton>
          </Row>
        </Card>

        <Card title="Theme">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3">
            <ThemeOption value="dark" current={theme} onSelect={setTheme} icon={<Moon className="h-6 w-6" aria-hidden />} label="Dark" />
            <ThemeOption value="light" current={theme} onSelect={setTheme} icon={<Sun className="h-6 w-6" aria-hidden />} label="Light" />
          </div>
        </Card>

        <ItemAvailability currency={me.venue.currency} />

        <Card title="Account">
          <Row label={`Signed in as ${me.vendor.name}`} hint={me.venue.name}>
            <AppButton
              size="xl"
              variant="danger"
              loading={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                await logout();
              }}
            >
              <LogOut className="h-6 w-6" aria-hidden />
              Log out
            </AppButton>
          </Row>
        </Card>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-card md:p-6" aria-labelledby={`h-${title}`}>
      <h2 id={`h-${title}`} className="mb-3 font-display text-h2 font-bold">
        {title}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-body font-semibold">{label}</p>
        {hint && <p className="text-small text-ink-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ThemeOption({
  value,
  current,
  onSelect,
  icon,
  label,
}: {
  value: Theme;
  current: Theme;
  onSelect: (t: Theme) => void;
  icon: ReactNode;
  label: string;
}) {
  const selected = value === current;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(value)}
      className={cx(
        "flex h-16 items-center justify-center gap-2 rounded-md border-2 text-body font-semibold focus-visible:ring-2 focus-visible:ring-brand-strong",
        selected ? "border-brand bg-brand text-on-brand" : "border-line text-ink hover:bg-surface-sunk",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ItemAvailability({ currency }: { currency: string }) {
  const q = useItems();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const setAvailable = async (item: MenuItem, available: boolean) => {
    const patch = (v: boolean) =>
      qc.setQueryData<VendorItemsResponse>(qk.items, (old) =>
        old ? { items: old.items.map((i) => (i.id === item.id ? { ...i, available: v } : i)) } : old,
      );
    patch(available);
    setBusy((b) => ({ ...b, [item.id]: true }));
    try {
      const body: AvailabilityRequest = { available };
      await apiFetch<MenuItem>(`/v1/vendor/items/${encodeURIComponent(item.id)}/availability`, { method: "POST", json: body });
      toast({ title: available ? `${item.name} is back on the menu` : `${item.name} marked sold out`, variant: "success" });
    } catch (e) {
      patch(!available);
      toast({ title: e instanceof ApiClientError ? `Couldn't update — ${e.message}` : "Couldn't update", variant: "error" });
    } finally {
      setBusy((b) => ({ ...b, [item.id]: false }));
    }
  };

  return (
    <Card title="Menu items">
      <p className="-mt-2 mb-2 text-small text-ink-muted">Sold-out items are hidden from guests right away.</p>
      {q.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState title="Couldn't load your menu" retry={() => void q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed className="h-8 w-8" />} title="No menu items yet" body="Your menu appears here after the venue syncs it." />
      ) : (
        <ul className="divide-y divide-line">
          {q.data.items.map((item) => (
            <li key={item.id} className="flex min-h-16 items-center justify-between gap-4 py-1">
              <div className="min-w-0">
                <p className={cx("truncate text-body font-semibold", !item.available && "text-ink-muted line-through")}>{item.name}</p>
                <p className="text-small text-ink-muted">
                  {item.category} · <MoneyText minor={item.priceMinor} currency={currency} />
                  {!item.available && <span className="ml-2 font-semibold text-brand-strong">Sold out</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="hidden text-small text-ink-muted sm:inline">{item.available ? "Available" : "Sold out"}</span>
                <Toggle
                  checked={item.available}
                  onChange={(v) => void setAvailable(item, v)}
                  label={`${item.name} available`}
                  disabled={busy[item.id]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
