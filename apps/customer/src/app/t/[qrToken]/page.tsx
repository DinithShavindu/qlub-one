"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, QrCode } from "lucide-react";
import { ApiClientError, EmptyState, ErrorState, Skeleton } from "@one/ui";
import { fetchMenu, GENERIC_ERROR, MENU_STALE_MS, qk, resolveTable } from "@/lib/api";
import { getCartStore } from "@/lib/cart-store";

const SPLASH_MS = 600;

export default function LandingPage({ params }: { params: { qrToken: string } }) {
  const { qrToken } = params;
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.table(qrToken), queryFn: () => resolveTable(qrToken) });

  const data = q.data;
  const live = data?.venue.status === "live";

  useEffect(() => {
    if (!data || !live) return;
    const { venue, table } = data;
    const store = getCartStore(venue.id);
    const remember = () => store.getState().setTable(table.id, table.label);
    // persist table after hydration so we don't clobber an in-progress cart
    if (store.persist.hasHydrated()) remember();
    else void Promise.resolve(store.persist.rehydrate()).then(remember);
    void qc.prefetchQuery({ queryKey: qk.menu(venue.id), queryFn: () => fetchMenu(venue.id), staleTime: MENU_STALE_MS });
    const t = setTimeout(
      () => router.replace(`/v/${venue.id}/menu?table=${encodeURIComponent(table.id)}`),
      SPLASH_MS,
    );
    return () => clearTimeout(t);
  }, [data, live, qc, router]);

  if (q.isError) {
    const err = q.error;
    if (err instanceof ApiClientError && (err.code === "QR_NOT_FOUND" || err.status === 404)) {
      return (
        <main className="flex min-h-dvh items-center justify-center">
          <EmptyState
            icon={<QrCode className="h-10 w-10" />}
            title="This QR isn't active. Ask staff for help."
          />
        </main>
      );
    }
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <ErrorState body={GENERIC_ERROR} retry={() => void q.refetch()} />
      </main>
    );
  }

  if (data && !live) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <EmptyState
          icon={<Clock className="h-10 w-10" />}
          title="Opening soon"
          body={`${data.venue.name} isn't taking orders yet. Check back shortly.`}
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center" aria-busy={!data}>
      {data ? (
        <>
          <h1 className="font-display text-h1 font-bold">{data.venue.name}</h1>
          <span className="rounded-full bg-surface px-4 py-1.5 text-body font-semibold shadow-card">
            Table {data.table.label}
          </span>
          <p className="flex gap-2 text-3xl" aria-label={`${data.vendors.length} stalls`}>
            {data.vendors.map((v) => (
              <span key={v.id} aria-hidden>
                {v.emoji}
              </span>
            ))}
          </p>
          <p className="text-small text-ink-muted">Opening the menu…</p>
        </>
      ) : (
        <>
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-40" />
          <span className="sr-only">Loading your table…</span>
        </>
      )}
    </main>
  );
}
