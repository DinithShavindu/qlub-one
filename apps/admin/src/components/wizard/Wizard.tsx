"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorState, Skeleton, StepWizard, apiFetch } from "@one/ui";
import type { AdminVenueDetailResponse, CreateVenueRequest, OnboardingRun, OnboardingStep, Venue } from "@one/contracts";
import { VenueStatusPill } from "@/components/shell/VenueStatusPill";
import { errorMessage, qk, useVenue } from "@/lib/queries";
import { GoLiveSummary } from "./GoLiveSummary";
import { MenuSyncList, type SyncState } from "./MenuSyncList";
import { OnboardingTimer } from "./OnboardingTimer";
import { StepTables } from "./StepTables";
import { StepVendors, EMPTY_VENDOR_FORM, type VendorFormState } from "./StepVendors";
import { StepVenueForm } from "./StepVenueForm";

const STEPS = ["Venue", "Vendors", "Menus", "Tables & QR", "Review & go live"];
const STEP_INDEX: Record<OnboardingStep, number> = { venue: 0, vendors: 1, menus: 2, tables: 3, live: 4 };

/**
 * Onboarding wizard. Progress lives server-side (onboarding_run); `?id=` resumes at `currentStep`.
 * Keyed by venue id by the page, so starting a new venue resets local state.
 */
export function Wizard({ venueId }: { venueId: string | null }) {
  const router = useRouter();
  const qc = useQueryClient();
  const detail = useVenue(venueId);
  const [step, setStep] = useState<number | null>(venueId ? null : 0);
  const [vendorForm, setVendorForm] = useState<VendorFormState>(EMPTY_VENDOR_FORM);
  const [sync, setSync] = useState<SyncState>({});

  const d = detail.data;
  const run = d?.onboardingRun ?? null;
  const live = d?.venue.status === "live";
  const maxReachable = live ? 4 : run ? STEP_INDEX[run.currentStep] : 0;

  // resume where the server says we are
  useEffect(() => {
    if (step === null && d) setStep(d.venue.status === "live" ? 4 : STEP_INDEX[d.onboardingRun?.currentStep ?? "vendors"]);
  }, [step, d]);

  const saveVenue = useMutation({
    mutationFn: async (req: CreateVenueRequest) => {
      if (!venueId) {
        return apiFetch<{ venue: Venue; onboardingRun: OnboardingRun }>("/v1/admin/venues", { method: "POST", json: req });
      }
      const changed = d && (d.venue.name !== req.name || d.venue.feeBps !== req.feeBps);
      if (changed) await apiFetch(`/v1/admin/venues/${venueId}`, { method: "PATCH", json: req });
      return null;
    },
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: qk.venues });
      if (created) {
        // prime the cache so the resumed wizard renders instantly at step 2
        const seed: AdminVenueDetailResponse = {
          venue: created.venue,
          vendors: [],
          tableCount: 0,
          itemCount: 0,
          onboardingRun: created.onboardingRun,
          baselineMinPerVendor: 30,
        };
        qc.setQueryData(qk.venue(created.venue.id), seed);
        void qc.invalidateQueries({ queryKey: qk.venue(created.venue.id) });
        router.replace(`/venues/new?id=${created.venue.id}`);
      } else {
        void qc.invalidateQueries({ queryKey: qk.venue(venueId!) });
        setStep(1);
      }
    },
  });

  const go = (i: number) => {
    setStep(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  let body: ReactNode;
  if (venueId && detail.isPending) {
    body = (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  } else if (venueId && detail.isError) {
    body = <ErrorState title="Couldn't load this venue" body={detail.error.message} retry={() => void detail.refetch()} />;
  } else if (step === 0 || step === null || !d) {
    body = (
      <StepVenueForm
        venue={d?.venue ?? null}
        submitting={saveVenue.isPending}
        serverError={saveVenue.isError ? errorMessage(saveVenue.error) : null}
        onSubmit={(req) => saveVenue.mutate(req)}
      />
    );
  } else if (step === 1) {
    body = <StepVendors detail={d} form={vendorForm} setForm={setVendorForm} onBack={() => go(0)} onNext={() => go(2)} />;
  } else if (step === 2) {
    body = <MenuSyncList detail={d} sync={sync} setSync={setSync} onBack={() => go(1)} onNext={() => go(3)} />;
  } else if (step === 3) {
    body = <StepTables detail={d} onBack={() => go(2)} onNext={() => go(4)} />;
  } else {
    body = <GoLiveSummary detail={d} onBack={() => go(3)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-micro font-semibold uppercase text-ink-muted">Onboarding</p>
          <h1 className="flex items-center gap-3 font-display text-h1 font-bold">
            <span className="truncate">{d?.venue.name ?? "New food court"}</span>
            {d && <VenueStatusPill status={d.venue.status} />}
          </h1>
        </div>
        <OnboardingTimer startedAt={run?.startedAt ?? null} finishedAt={run?.finishedAt ?? null} />
      </div>
      <StepWizard steps={STEPS} current={step ?? 0} maxReachable={d ? maxReachable : 0} onStepClick={d ? go : undefined} />
      <div>{body}</div>
    </div>
  );
}
