import { ONBOARDING_STEPS, type OnboardingRun, type OnboardingStep } from "@one/contracts";
import { db, newId, NO_ID } from "@one/db";
import { nowIso } from "../lib/time";

export async function startRun(venueId: string): Promise<OnboardingRun> {
  const c = await db();
  const now = nowIso();
  const run: OnboardingRun = { id: newId("run"), venueId, startedAt: now, finishedAt: null, steps: { venue: now }, currentStep: "vendors" };
  await c.onboardingRuns.insertOne({ ...run });
  return run;
}

export async function getRun(venueId: string): Promise<OnboardingRun | null> {
  const c = await db();
  return c.onboardingRuns.findOne({ venueId }, { ...NO_ID, sort: { startedAt: -1 } });
}

/** Mark a wizard step done and advance `currentStep` (never moves backwards). */
export async function completeStep(venueId: string, step: OnboardingStep): Promise<OnboardingRun | null> {
  const c = await db();
  const run = await getRun(venueId);
  if (!run) return null;
  const next = ONBOARDING_STEPS[Math.min(ONBOARDING_STEPS.indexOf(step) + 1, ONBOARDING_STEPS.length - 1)]!;
  const currentStep = ONBOARDING_STEPS.indexOf(next) > ONBOARDING_STEPS.indexOf(run.currentStep) ? next : run.currentStep;
  const now = nowIso();
  const set: Record<string, unknown> = { [`steps.${step}`]: run.steps[step] ?? now, currentStep };
  if (step === "live") set.finishedAt = run.finishedAt ?? now;
  return c.onboardingRuns.findOneAndUpdate({ id: run.id }, { $set: set }, { returnDocument: "after", projection: { _id: 0 } });
}
