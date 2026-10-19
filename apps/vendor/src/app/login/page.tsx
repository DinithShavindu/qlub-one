"use client";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronRight, Store } from "lucide-react";
import type { VendorVenueLookupResponse } from "@one/contracts";
import { ApiClientError, apiFetch, EmptyState, ErrorState, Skeleton } from "@one/ui";
import { AppButton } from "@/components/AppButton";
import { PinStep, type LoginTarget } from "@/components/login/PinStep";
import { VendorTilePicker } from "@/components/login/VendorTilePicker";
import { useMe } from "@/lib/queries";
import { readStorage, STORAGE_KEYS, writeStorage } from "@/lib/storage";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 py-8 sm:py-12">
      <Suspense fallback={<TilesSkeleton />}>
        <LoginFlow />
      </Suspense>
    </main>
  );
}

function LoginFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const code = (params.get("venue") ?? "").trim().toUpperCase();
  const [picked, setPicked] = useState<LoginTarget | null>(null);

  // already signed in (session survives refresh for 12h) → straight to the board
  const me = useMe();
  useEffect(() => {
    if (me.data) router.replace("/");
  }, [me.data, router]);

  const lookup = useQuery({
    queryKey: ["vendor", "venue", code],
    queryFn: () => apiFetch<VendorVenueLookupResponse>(`/v1/vendor/venues/${encodeURIComponent(code)}`),
    enabled: code.length > 0,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (lookup.data) writeStorage(STORAGE_KEYS.venueCode, lookup.data.venue.code);
  }, [lookup.data]);

  const changeVenue = () => {
    setPicked(null);
    router.replace("/login");
  };

  if (!code) return <VenueCodeStep onSubmit={(c) => router.replace(`/login?venue=${encodeURIComponent(c)}`)} />;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-micro font-semibold uppercase text-ink-muted">qlub vendor panel</p>
          <h1 className="font-display text-h1 font-bold">{lookup.data?.venue.name ?? "Sign in"}</h1>
        </div>
        <button
          type="button"
          onClick={changeVenue}
          className="h-12 rounded-md px-3 text-body font-semibold text-brand-strong underline-offset-2 hover:underline"
        >
          Change venue ({code})
        </button>
      </header>

      {lookup.isPending ? (
        <TilesSkeleton />
      ) : lookup.isError ? (
        lookup.error instanceof ApiClientError && lookup.error.status === 404 ? (
          <EmptyState
            icon={<Store className="h-10 w-10" />}
            title={`No venue with code ${code}`}
            body="Check the code on your setup sheet and try again."
            action={
              <AppButton size="lg" onClick={changeVenue}>
                Enter another code
              </AppButton>
            }
          />
        ) : (
          <ErrorState title="Couldn't load stalls" retry={() => void lookup.refetch()} />
        )
      ) : picked ? (
        <PinStep target={picked} onBack={() => setPicked(null)} />
      ) : lookup.data.vendors.length === 0 ? (
        <EmptyState icon={<Store className="h-10 w-10" />} title="No stalls yet" body="Ask your qlub contact to add your stall to this venue." />
      ) : (
        <>
          {lookup.data.venue.hasManager && (
            <button
              type="button"
              onClick={() => setPicked({ kind: "manager", venueId: lookup.data.venue.id, venueName: lookup.data.venue.name })}
              className="flex min-h-[80px] w-full items-center gap-4 rounded-lg border-2 border-brand/50 bg-surface p-4 text-left shadow-card transition hover:bg-surface-sunk focus-visible:ring-2 focus-visible:ring-brand-strong"
            >
              <Building2 className="h-10 w-10 shrink-0 text-brand-strong" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-h2 font-bold">Venue manager</span>
                <span className="block text-small text-ink-muted">All {lookup.data.vendors.length} vendors — combined orders, dashboard and reports</span>
              </span>
              <ChevronRight className="h-6 w-6 text-ink-soft" aria-hidden />
            </button>
          )}
          <h2 className="text-h2 font-semibold">{lookup.data.venue.type === "restaurant" ? "Tap your restaurant" : lookup.data.venue.hasManager ? "Or tap your stall" : "Tap your stall"}</h2>
          <VendorTilePicker vendors={lookup.data.vendors} onPick={(v) => setPicked({ kind: "vendor", vendor: v })} />
        </>
      )}
    </div>
  );
}

function VenueCodeStep({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(readStorage(STORAGE_KEYS.venueCode) ?? "");
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = value.trim().toUpperCase();
    if (!c) {
      setError("Enter your venue code");
      return;
    }
    onSubmit(c);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <div>
        <p className="text-micro font-semibold uppercase text-ink-muted">Kitchen display</p>
        <h1 className="font-display text-h1 font-bold">Sign in to your stall</h1>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="venue-code" className="text-body font-semibold">
          Venue code
        </label>
        <input
          id="venue-code"
          value={value}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase());
            setError(null);
          }}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. HARBOUR"
          aria-invalid={!!error}
          aria-describedby={error ? "venue-code-error" : "venue-code-hint"}
          className="h-16 rounded-md border border-line bg-surface px-4 font-display text-h1 font-bold uppercase tracking-wide text-ink placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-brand-strong"
        />
        {error ? (
          <p id="venue-code-error" className="text-small font-semibold text-brand-strong">
            {error}
          </p>
        ) : (
          <p id="venue-code-hint" className="text-small text-ink-muted">
            It&apos;s on the setup sheet from your venue manager.
          </p>
        )}
      </div>
      <AppButton type="submit" size="xl" block>
        Continue
      </AppButton>
    </form>
  );
}

function TilesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading stalls">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
  );
}
