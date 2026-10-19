"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Store } from "lucide-react";
import { Button, EmptyState, ErrorState, Skeleton, VendorBadge, apiFetch } from "@one/ui";
import type { AdminVendor, ResetPinResponse } from "@one/contracts";
import { ButtonLink } from "@/components/ButtonLink";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { OpenToggle } from "@/components/OpenToggle";
import { PageHeader } from "@/components/PageHeader";
import { DraftBanner } from "@/components/venue/DraftBanner";
import { PinRevealModal, type PinRow } from "@/components/wizard/PinRevealModal";
import { errorMessage, useVenue } from "@/lib/queries";

export default function VendorsPage() {
  const { id } = useParams<{ id: string }>();
  const q = useVenue(id);
  const [confirm, setConfirm] = useState<AdminVendor | null>(null);
  const [revealed, setRevealed] = useState<PinRow[] | null>(null);

  const reset = useMutation({
    mutationFn: (v: AdminVendor) => apiFetch<ResetPinResponse>(`/v1/admin/vendors/${v.id}/reset-pin`, { method: "POST" }),
    onSuccess: (res, v) => {
      setConfirm(null);
      setRevealed([{ vendorId: res.vendorId, name: v.name, pin: res.pin }]);
    },
  });

  if (q.isPending) {
    return (
      <>
        <Skeleton className="mb-6 h-10 w-64" />
        <Skeleton className="h-80 w-full" />
      </>
    );
  }
  if (q.isError) return <ErrorState title="Couldn't load vendors" body={q.error.message} retry={() => void q.refetch()} />;
  const { venue, vendors } = q.data;

  return (
    <>
      {venue.status === "draft" && <DraftBanner venueId={id} />}
      <PageHeader title="Vendors" subtitle={`${venue.name} · ${vendors.length} vendors, one venue`} />

      <div className="mb-6 flex items-center gap-6 rounded-2xl border border-line bg-surface px-6 py-5">
        <div>
          <p className="text-micro font-semibold uppercase text-ink-muted">Venue code</p>
          <p className="select-all font-display text-display font-bold tracking-wider">{venue.code}</p>
        </div>
        <p className="max-w-xl text-small text-ink-soft">
          Vendors sign in on their kitchen screen with this venue code and their own 4-digit PIN. PINs are only shown when created or reset —
          reset a PIN if a vendor loses it.
        </p>
      </div>

      <Card>
        {vendors.length === 0 ? (
          <EmptyState
            icon={<Store className="h-8 w-8" />}
            title="No vendors yet"
            body="Add vendors from the POS directory or paste a list in the onboarding wizard."
            action={<ButtonLink href={`/venues/new?id=${id}`}>Add vendors</ButtonLink>}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th className="font-semibold">Vendor</th>
                <th className="font-semibold">Pickup letter</th>
                <th className="font-semibold">Mode</th>
                <th className="text-right font-semibold">Menu items</th>
                <th className="font-semibold">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td>
                    <VendorBadge vendor={v} />
                  </td>
                  <td className="font-display font-bold">{v.letter}-##</td>
                  <td className="text-ink-soft">
                    {v.posMode === "mock_pos" ? (
                      <>
                        Mock POS <span className="font-mono text-micro text-ink-muted">{v.posVendorId}</span>
                      </>
                    ) : (
                      "Tablet (KDS)"
                    )}
                  </td>
                  <td className={`text-right tabular-nums ${v.itemCount === 0 ? "font-semibold text-status-failed-fg" : ""}`}>
                    {v.itemCount === 0 ? "0 — no menu" : v.itemCount}
                  </td>
                  <td>
                    <OpenToggle vendor={v} venueId={id} />
                  </td>
                  <td className="text-right">
                    <Button variant="secondary" size="sm" onClick={() => setConfirm(v)}>
                      <KeyRound className="h-4 w-4" aria-hidden /> Reset PIN
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={!!confirm}
        onClose={() => {
          setConfirm(null);
          reset.reset();
        }}
        title={`Reset PIN for ${confirm?.name ?? "vendor"}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button loading={reset.isPending} onClick={() => confirm && reset.mutate(confirm)}>
              Reset PIN
            </Button>
          </>
        }
      >
        <p className="text-small text-ink-soft">The old PIN stops working immediately. The new PIN is shown once.</p>
        {reset.isError && (
          <p role="alert" className="mt-3 text-small text-status-failed-fg">
            Couldn&apos;t reset: {errorMessage(reset.error)}
          </p>
        )}
      </Modal>

      <PinRevealModal pins={revealed} venueCode={venue.code} onDone={() => setRevealed(null)} doneLabel="Done" />
    </>
  );
}
