"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, QrCode, ShoppingBag } from "lucide-react";
import type { QuoteIssue, Simulate } from "@one/contracts";
import { ApiClientError, Button, EmptyState, ErrorState, formatMoney, MoneyText, Skeleton, VendorBadge } from "@one/ui";
import { PageHeader } from "@/components/PageHeader";
import { TestPaymentTile } from "@/components/TestPaymentTile";
import { GENERIC_ERROR, newIdempotencyKey, postCheckout, qk } from "@/lib/api";
import { getCartStore, toCartLines, useCartHydrated } from "@/lib/cart-store";
import { useMenu } from "@/lib/use-menu";
import { useQuote } from "@/lib/use-quote";

const NAME_MAX = 20;

export default function CheckoutPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;
  const router = useRouter();
  const qc = useQueryClient();
  const hydrated = useCartHydrated(venueId);
  const menu = useMenu(venueId);
  const quote = useQuote(venueId, hydrated);
  const { lines, tableId } = quote;
  const store = getCartStore(venueId);
  const cartHref = `/v/${venueId}/cart`;
  const nameId = useId();

  const [name, setName] = useState("");
  const [simulate, setSimulate] = useState<Simulate | undefined>(undefined);
  const [payError, setPayError] = useState<string | null>(null);
  const [placed, setPlaced] = useState(false);
  // one key per checkout attempt; kept across network blips so a retry can't double-charge
  const idemKey = useRef<string>("");
  if (!idemKey.current) idemKey.current = newIdempotencyKey();

  const pay = useMutation({
    mutationFn: () =>
      postCheckout({
        venueId,
        tableId: tableId!,
        lines: toCartLines(lines),
        paymentMethod: "test_card",
        ...(name.trim() ? { guestFirstName: name.trim().slice(0, NAME_MAX) } : {}),
        ...(simulate ? { simulate } : {}),
        idempotencyKey: idemKey.current,
      }),
    onMutate: () => setPayError(null),
    onSuccess: (res) => {
      setPlaced(true);
      qc.setQueryData(qk.order(res.masterOrder.id), res);
      router.replace(`/o/${res.masterOrder.id}`);
      store.getState().clear();
    },
    onError: (err) => {
      if (!(err instanceof ApiClientError)) {
        setPayError(GENERIC_ERROR);
        return;
      }
      if (err.code === "NETWORK") {
        setPayError(GENERIC_ERROR);
        return; // keep the key: the server may have charged
      }
      idemKey.current = newIdempotencyKey();
      if (err.code === "PAYMENT_DECLINED") {
        setPayError("Payment didn't go through. Nothing was charged.");
      } else if (err.code === "ITEM_UNAVAILABLE" || err.code === "VENDOR_CLOSED") {
        const issues = ((err.details as { issues?: QuoteIssue[] } | undefined)?.issues ?? []) as QuoteIssue[];
        const st = store.getState();
        if (issues.length) st.removeItems(issues.map((i) => i.menuItemId));
        st.setNotice(issues.length ? issues.map((i) => i.message) : [err.message]);
        router.replace(cartHref);
      } else if (err.code === "VENUE_NOT_LIVE") {
        setPayError("This venue isn't taking orders yet.");
      } else {
        setPayError(GENERIC_ERROR);
      }
    },
  });

  // quote found sold-out items / closed stalls → the cart explains what changed
  useEffect(() => {
    if (quote.isCurrent && quote.data?.issues.length && !pay.isPending && !placed) router.replace(cartHref);
  }, [quote.isCurrent, quote.data, pay.isPending, placed, router, cartHref]);

  // hold the guest on this screen while the payment is in flight
  useEffect(() => {
    if (!pay.isPending) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.history.pushState(window.history.state, "", window.location.href);
    const onPop = () => window.history.pushState(window.history.state, "", window.location.href);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPop);
    };
  }, [pay.isPending]);

  if (placed) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-brand-strong" aria-hidden />
        <p className="font-semibold">Paid — opening your order…</p>
      </main>
    );
  }

  const q = quote.data;
  let body: ReactNode;
  if (!hydrated) {
    body = <Skeleton className="h-48 w-full rounded-lg" />;
  } else if (!lines.length) {
    body = (
      <EmptyState
        icon={<ShoppingBag className="h-10 w-10" />}
        title="Your cart is empty"
        action={
          <Link href={`/v/${venueId}/menu`} className="inline-flex h-11 items-center rounded-md bg-brand px-4 font-semibold text-on-brand">
            Browse menu
          </Link>
        }
      />
    );
  } else if (!tableId) {
    body = (
      <EmptyState
        icon={<QrCode className="h-10 w-10" />}
        title="We don't know your table yet"
        body="Scan the QR on your table again so the stalls know where to find you."
      />
    );
  } else if (!q && quote.isError) {
    body = <ErrorState body={GENERIC_ERROR} retry={() => void quote.refetch()} />;
  } else if (!q) {
    body = (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  } else {
    body = (
      <>
        <section aria-labelledby="summary-heading" className="rounded-lg bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h2 id="summary-heading" className="text-small font-semibold">
              Your order
            </h2>
            <Link href={cartHref} className="text-small font-semibold text-brand-strong underline underline-offset-2">
              Edit
            </Link>
          </div>
          <ul className="mt-2 divide-y divide-line">
            {q.groups.map((g) => {
              const v = menu.vendorsById.get(g.vendorId);
              const count = g.lines.reduce((a, l) => a + l.qty, 0);
              return (
                <li key={g.vendorId}>
                  <details className="group py-2">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-0 items-center gap-2">
                        {v ? <VendorBadge vendor={v} size="sm" /> : <span>Stall</span>}
                        <span className="shrink-0 text-small text-ink-muted">
                          · {count} item{count === 1 ? "" : "s"}
                        </span>
                      </span>
                      <MoneyText minor={g.subtotalMinor} currency={q.currency} className="shrink-0 text-small font-semibold" />
                    </summary>
                    <ul className="space-y-1 pb-1 pl-7 text-small text-ink-soft">
                      {g.lines.map((l) => (
                        <li key={`${l.menuItemId}:${l.note ?? ""}`} className="flex justify-between gap-3">
                          <span className="min-w-0">
                            {l.qty}× {l.name}
                            {l.note && <span className="block text-ink-muted">“{l.note}”</span>}
                          </span>
                          <MoneyText minor={l.lineTotalMinor} currency={q.currency} className="shrink-0" />
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
            <span className="font-display text-h2 font-bold">Total</span>
            <MoneyText minor={q.totalMinor} currency={q.currency} className="font-display text-h2 font-bold" />
          </div>
        </section>

        <section className="rounded-lg bg-surface p-4 shadow-card">
          <label htmlFor={nameId} className="text-small font-semibold">
            Name for pickup (optional)
          </label>
          <input
            id={nameId}
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
            autoComplete="given-name"
            disabled={pay.isPending}
            aria-describedby={`${nameId}-help`}
            className="mt-1 h-11 w-full rounded-md border border-line bg-surface px-3 text-body focus-visible:ring-2 focus-visible:ring-brand-strong"
          />
          <p id={`${nameId}-help`} className="mt-1 text-small text-ink-muted">
            Only used so stalls can call you.
          </p>
        </section>

        <TestPaymentTile simulate={simulate} onSimulateChange={setSimulate} disabled={pay.isPending} />
      </>
    );
  }

  const ready = hydrated && !!q && quote.isCurrent && !!tableId && lines.length > 0 && q.groups.length > 0 && !q.issues.length;

  return (
    <>
      <PageHeader title="Checkout" backHref={pay.isPending ? undefined : cartHref} backLabel="Back to cart" />
      <main className="flex flex-col gap-4 px-4 pb-32 pt-4">{body}</main>
      {ready && q && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-customer border-t border-line bg-paper/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {payError && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-3 rounded-lg border border-status-failed-fg/30 bg-status-failed p-3 text-status-failed-fg"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <p className="text-small font-semibold">{payError}</p>
            </div>
          )}
          <Button size="lg" block loading={pay.isPending} disabled={quote.isFetching} onClick={() => pay.mutate()}>
            {pay.isPending ? "Paying…" : payError ? `Try again · ${formatMoney(q.totalMinor, q.currency)}` : `Pay ${formatMoney(q.totalMinor, q.currency)}`}
          </Button>
        </div>
      )}
    </>
  );
}
