"use client";
import { useState, type ReactNode } from "react";
import { LogOut, Moon, Sun, Volume2 } from "lucide-react";
import { playNewOrderBeeps, unlockAudio } from "@one/ui";
import { AppButton } from "@/components/AppButton";
import { PanelPage } from "@/components/shell/PanelShell";
import { Panel } from "@/components/panel/ui";
import { Toggle } from "@/components/Toggle";
import { useLogout } from "@/hooks/useLogout";
import { cx } from "@/lib/cx";
import { usePanel } from "@/lib/panel";
import { usePrefs, type Theme } from "@/lib/prefs";

const FLOW: Record<string, string> = { qsr: "QSR — guests order & pay by QR", pat: "PAT — guests pay the POS bill at the table" };

export default function SettingsPage() {
  const { me, isManager } = usePanel();
  const { soundOn, setSoundOn, theme, setTheme } = usePrefs();
  const logout = useLogout();
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <PanelPage title="Settings">
      <div className="flex max-w-3xl flex-col gap-6">
        <Panel title="QSR order sound">
          <div className="flex flex-col px-5 py-2">
            <Row label="New order sound" hint="Two short beeps when an order arrives">
              <Toggle checked={soundOn} onChange={setSoundOn} label="New order sound" />
            </Row>
            <Row label="Test sound" hint="Check the tablet volume">
              <AppButton
                variant="secondary"
                onClick={async () => {
                  await unlockAudio();
                  playNewOrderBeeps();
                }}
              >
                <Volume2 className="h-5 w-5" aria-hidden />
                Play
              </AppButton>
            </Row>
          </div>
        </Panel>

        <Panel title="Theme">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3 p-5">
            <ThemeOption value="light" current={theme} onSelect={setTheme} icon={<Sun className="h-5 w-5" aria-hidden />} label="Light" />
            <ThemeOption value="dark" current={theme} onSelect={setTheme} icon={<Moon className="h-5 w-5" aria-hidden />} label="Dark (kitchen)" />
          </div>
        </Panel>

        <Panel title="Venue">
          <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-body sm:grid-cols-2">
            <Info label="Venue" value={`${me.venue.name} (${me.venue.code})`} />
            <Info label="Type" value={me.venue.type === "restaurant" ? "Restaurant" : me.venue.type === "hotel" ? "Hotel (multivendor)" : "Food court (multivendor)"} />
            <Info label="Flow" value={FLOW[me.venue.flow] ?? me.venue.flow} />
            <Info label="Vendors" value={String(me.vendors.length)} />
          </dl>
        </Panel>

        <Panel title="Account">
          <div className="px-5 py-2">
            <Row label={isManager ? "Signed in as venue manager" : `Signed in as ${me.vendor!.name}`} hint={me.venue.name}>
              <AppButton
                variant="danger"
                loading={loggingOut}
                onClick={async () => {
                  setLoggingOut(true);
                  await logout();
                }}
              >
                <LogOut className="h-5 w-5" aria-hidden />
                Log out
              </AppButton>
            </Row>
          </div>
        </Panel>
      </div>
    </PanelPage>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-small text-ink-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
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

function ThemeOption({ value, current, onSelect, icon, label }: { value: Theme; current: Theme; onSelect: (t: Theme) => void; icon: ReactNode; label: string }) {
  const selected = value === current;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(value)}
      className={cx(
        "flex h-14 items-center justify-center gap-2 rounded-xl border-2 text-body font-semibold focus-visible:ring-2 focus-visible:ring-brand-strong",
        selected ? "border-brand bg-brand text-on-brand" : "border-line text-ink hover:bg-surface-sunk",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
