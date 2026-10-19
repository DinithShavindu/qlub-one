"use client";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";
import { Button, VendorBadge, apiFetch, useToast } from "@one/ui";
import type { AdminVenueDetailResponse, BulkVendorsResponse } from "@one/contracts";
import { errorMessage, qk, usePosVendors } from "@/lib/queries";
import { accentAt, parsePaste, toBulkInput, validateDrafts, type VendorDraft } from "@/lib/vendor-draft";
import { plural } from "@/lib/format";
import { BulkVendorPaste } from "./BulkVendorPaste";
import { PinRevealModal, type PinRow } from "./PinRevealModal";
import { VendorPicker } from "./VendorPicker";
import { VendorPreviewTable } from "./VendorPreviewTable";

/** Draft vendor input, lifted to the wizard so Back never loses it. */
export interface VendorFormState {
  picked: string[];
  paste: string;
  overrides: Record<string, Partial<VendorDraft>>;
}
export const EMPTY_VENDOR_FORM: VendorFormState = { picked: [], paste: "", overrides: {} };

export function StepVendors({
  detail,
  form,
  setForm,
  onBack,
  onNext,
}: {
  detail: AdminVenueDetailResponse;
  form: VendorFormState;
  setForm: (f: VendorFormState) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const venueId = detail.venue.id;
  const qc = useQueryClient();
  const { toast } = useToast();
  const pos = usePosVendors();
  const [pins, setPins] = useState<PinRow[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const existing = detail.vendors;
  const directory = useMemo(() => pos.data?.vendors ?? [], [pos.data]);
  const usedPos = new Set(existing.map((v) => v.posVendorId).filter(Boolean));
  const available = directory.filter((p) => !usedPos.has(p.posVendorId));
  const parsed = useMemo(() => parsePaste(form.paste, directory), [form.paste, directory]);

  const pickedRows = form.picked
      .map((pid) => directory.find((p) => p.posVendorId === pid))
      .filter((p): p is NonNullable<typeof p> => !!p && !usedPos.has(p.posVendorId))
      .map((p) => ({
        key: `pos:${p.posVendorId}`,
        source: "pos" as const,
        name: p.displayName,
        emoji: p.emoji,
        posMode: "mock_pos" as const,
        posVendorId: p.posVendorId,
      }));
  const drafts: VendorDraft[] = [...pickedRows, ...parsed.rows].map((r, i) => ({
    ...r,
    accentToken: accentAt(existing.length + i),
    ...form.overrides[r.key],
  }));

  const errors = validateDrafts(drafts, existing.map((v) => v.name));
  const errorCount = Object.keys(errors).length;

  const create = useMutation({
    mutationFn: () =>
      apiFetch<BulkVendorsResponse>(`/v1/admin/venues/${venueId}/vendors/bulk`, { method: "POST", json: { vendors: drafts.map(toBulkInput) } }),
    onSuccess: (res) => {
      setServerError(null);
      setPins(res.pins);
      setForm(EMPTY_VENDOR_FORM);
      // show the new vendors immediately (no refetch race before the menus step)
      qc.setQueryData<AdminVenueDetailResponse>(qk.venue(venueId), (prev) =>
        prev ? { ...prev, vendors: [...prev.vendors, ...res.vendors.map((v) => ({ ...v, itemCount: 0 }))] } : prev,
      );
      void qc.invalidateQueries({ queryKey: qk.venue(venueId) });
      void qc.invalidateQueries({ queryKey: qk.venues });
    },
    onError: (e) => setServerError(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (vendorId: string) => apiFetch(`/v1/admin/vendors/${vendorId}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.venue(venueId) }),
    onError: (e) => toast({ title: `Couldn't remove vendor: ${errorMessage(e)}`, variant: "error" }),
  });

  function edit(key: string, patch: Partial<VendorDraft>) {
    setForm({ ...form, overrides: { ...form.overrides, [key]: { ...form.overrides[key], ...patch } } });
  }
  function removeDraft(d: VendorDraft) {
    if (d.source === "pos") setForm({ ...form, picked: form.picked.filter((p) => p !== d.posVendorId) });
    else setForm({ ...form, paste: form.paste.split("\n").filter((_, i) => i + 1 !== d.line).join("\n") });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-brand/40 bg-surface px-5 py-4">
        <p className="font-display text-h2 font-bold">Add every vendor in one go</p>
        <p className="text-small text-ink-soft">
          Today each stall is its own restaurant setup. Here they&apos;re all outlets of one venue — pick POS-connected vendors and paste the rest.
        </p>
      </div>

      {existing.length > 0 && (
        <section aria-label="Vendors already in this venue" className="rounded-lg border border-line bg-surface">
          <h3 className="border-b border-line px-4 py-3 font-display text-body font-bold">
            Already in this venue · {plural(existing.length, "vendor")}
          </h3>
          <ul className="divide-y divide-line">
            {existing.map((v) => (
              <li key={v.id} className="flex items-center gap-4 px-4 py-2.5">
                <VendorBadge vendor={v} />
                <span className="text-small text-ink-muted">{v.posMode === "mock_pos" ? `Mock POS · ${v.posVendorId}` : "Tablet"}</span>
                {detail.venue.status === "draft" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    loading={remove.isPending && remove.variables === v.id}
                    onClick={() => remove.mutate(v.id)}
                    aria-label={`Remove ${v.name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-6">
        <VendorPicker
          available={available}
          loading={pos.isPending}
          error={pos.isError ? pos.error.message : null}
          onRetry={() => void pos.refetch()}
          picked={form.picked}
          onChange={(picked) => setForm({ ...form, picked })}
        />
        <div className="flex flex-col gap-2">
          <BulkVendorPaste value={form.paste} onChange={(paste) => setForm({ ...form, paste })} issues={parsed.issues} />
          {!form.paste && (
            <button
              type="button"
              className="self-start text-small font-semibold text-brand-strong hover:underline"
              onClick={() => setForm({ ...form, paste: "Burger Lab, 🍔, tablet" })}
            >
              Paste example: Burger Lab, 🍔, tablet
            </button>
          )}
        </div>
      </div>

      {drafts.length > 0 && (
        <section aria-label="Preview">
          <h3 className="mb-2 font-display text-body font-bold">Preview · {plural(drafts.length, "new vendor")}</h3>
          <VendorPreviewTable drafts={drafts} errors={errors} posDirectory={directory} onEdit={edit} onRemove={removeDraft} />
        </section>
      )}

      {serverError && (
        <p role="alert" className="rounded-md bg-status-failed px-4 py-3 text-small font-semibold text-status-failed-fg">
          {serverError}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-line pt-6">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <div className="flex items-center gap-3">
          {errorCount > 0 && <span className="text-small text-status-failed-fg">Fix {plural(errorCount, "row")} to continue</span>}
          {drafts.length > 0 ? (
            <Button size="lg" disabled={errorCount > 0} loading={create.isPending} onClick={() => create.mutate()}>
              Create {plural(drafts.length, "vendor")}
            </Button>
          ) : (
            <Button size="lg" disabled={existing.length === 0} onClick={onNext}>
              {existing.length === 0 ? "Add at least one vendor" : "Continue to menus"}
              {existing.length > 0 && <ArrowRight className="h-4 w-4" aria-hidden />}
            </Button>
          )}
        </div>
      </div>

      <PinRevealModal
        pins={pins}
        venueCode={detail.venue.code}
        onDone={() => {
          setPins(null);
          onNext();
        }}
        doneLabel="I've saved these PINs — sync menus"
      />
    </div>
  );
}
