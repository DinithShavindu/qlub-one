"use client";
import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QrCode, ShoppingBag } from "lucide-react";
import type { Vendor } from "@one/contracts";
import { Button, EmptyState, ErrorState, formatMoney, Skeleton } from "@one/ui";
import { CartSummary } from "@/components/CartSummary";
import { CartVendorGroup } from "@/components/CartVendorGroup";
import { NoticeBanner } from "@/components/NoticeBanner";
import { PageHeader } from "@/components/PageHeader";
import { GENERIC_ERROR } from "@/lib/api";
import { getCartStore, useCart, useCartHydrated, type StoredLine } from "@/lib/cart-store";
import { useMenu } from "@/lib/use-menu";
import { useQuote } from "@/lib/use-quote";

export default function CartPage({ params }: { params: { venueId: string } }) {
  const { venueId } = params;
  const router = useRouter();
  const hydrated = useCartHydrated(venueId);
  const notice = useCart(venueId, (s) => s.notice);
  const menu = useMenu(venueId);
  const quote = useQuote(venueId, hydrated);
  const { lines, tableId } = quote;
  const store = getCartStore(venueId);
  const menuHref = `/v/${venueId}/menu`;

  const groups = useMemo(() => {
    const byVendor = new Map<string, StoredLine[]>();
    for (const l of lines) byVendor.set(l.vendorId, [...(byVendor.get(l.vendorId) ?? []), l]);
    const order = (id: string) => menu.vendorsById.get(id)?.sortOrder ?? 999;
    return [...byVendor.entries()].sort(([a], [b]) => order(a) - order(b));
  }, [lines, menu.vendorsById]);

  const noticeBanner = notice?.length ? (
    <NoticeBanner messages={notice} onDismiss={() => store.getState().setNotice(null)} />
  ) : null;

  let body: ReactNode;
  if (!hydrated) {
    body = <CartSkeleton />;
  } else if (!lines.length) {
    body = (
      <>
        {noticeBanner}
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10" />}
          title="Your cart is empty"
          body="Add something from any stall — you'll pay once for everything."
          action={
            <Link href={menuHref} className="inline-flex h-11 items-center rounded-full bg-brand px-5 font-semibold text-on-brand">
              Browse menu
            </Link>
          }
        />
      </>
    );
  } else if (!tableId) {
    body = (
      <EmptyState
        icon={<QrCode className="h-10 w-10" />}
        title="We don't know your table yet"
        body="Scan the QR on your table again so the stalls know where to find you."
      />
    );
  } else {
    const q = quote.data;
    const currency = q?.currency ?? menu.data?.venue.currency ?? "AED";
    body = (
      <>
        {noticeBanner}
        {groups.map(([vendorId, vLines]) => (
          <CartVendorGroup
            key={vendorId}
            vendor={menu.vendorsById.get(vendorId) as Vendor | undefined}
            lines={vLines}
            quoteGroup={q?.groups.find((g) => g.vendorId === vendorId)}
            currency={currency}
            onQty={(key, n) => store.getState().setQty(key, n)}
            onRemove={(key) => store.getState().remove(key)}
          />
        ))}
        {quote.isError && !q ? (
          <ErrorState body={GENERIC_ERROR} retry={() => void quote.refetch()} />
        ) : q ? (
          <CartSummary quote={q} vendorsById={menu.vendorsById} updating={quote.isFetching} />
        ) : (
          <Skeleton className="h-36 w-full rounded-lg" />
        )}
        <Link href={menuHref} className="self-center py-2 text-small font-semibold text-brand-strong underline underline-offset-2">
          Add more items
        </Link>
      </>
    );
  }

  const q = quote.data;
  const canCheckout = hydrated && !!tableId && lines.length > 0 && !!q && quote.isCurrent && !quote.isFetching && q.groups.length > 0;

  return (
    <>
      <PageHeader title="Your cart" backHref={menuHref} backLabel="Back to menu" />
      <main className="flex flex-col gap-4 px-4 pb-32 pt-4">{body}</main>
      {hydrated && lines.length > 0 && tableId && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-customer border-t border-line bg-paper/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <Button
            size="lg"
            block
            className="rounded-full"
            disabled={!canCheckout}
            loading={quote.isFetching}
            onClick={() => router.push(`/v/${venueId}/checkout`)}
          >
            {q ? `Checkout · ${formatMoney(q.totalMinor, q.currency)}` : "Checkout"}
          </Button>
        </div>
      )}
    </>
  );
}

function CartSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading cart">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3 rounded-lg bg-surface p-4 shadow-card">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
      <Skeleton className="h-36 w-full rounded-lg" />
    </div>
  );
}
