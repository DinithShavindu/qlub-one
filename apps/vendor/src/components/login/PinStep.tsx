"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { VendorLoginRequest, VendorMeResponse, VendorVenueLookupResponse } from "@one/contracts";
import { ApiClientError, apiFetch, unlockAudio, VendorBadge } from "@one/ui";
import { qk } from "@/lib/queries";
import { PinPad, PIN_LENGTH } from "./PinPad";

type TileVendor = VendorVenueLookupResponse["vendors"][number];

export function PinStep({ vendor, onBack }: { vendor: TileVendor; onBack: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triesLeft, setTriesLeft] = useState<number | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const coolingDown = cooldownLeft > 0;

  useEffect(() => {
    if (!cooldownUntil) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [cooldownUntil]);

  useEffect(() => {
    if (cooldownUntil && !coolingDown) {
      setCooldownUntil(0);
      setError(null);
      setTriesLeft(null);
    }
  }, [cooldownUntil, coolingDown]);

  const submit = useCallback(
    async (value: string) => {
      setBusy(true);
      setError(null);
      // the PIN tap is a user gesture → unlock Web Audio for new-order beeps
      void unlockAudio();
      try {
        const body: VendorLoginRequest = { vendorId: vendor.id, pin: value };
        const me = await apiFetch<VendorMeResponse>("/v1/vendor/login", { method: "POST", json: body });
        qc.setQueryData(qk.me, me);
        router.replace("/");
      } catch (e) {
        setPin("");
        setBusy(false);
        setShakeKey((k) => k + 1);
        if (e instanceof ApiClientError && e.code === "WRONG_PIN") {
          const left = (e.details as { triesLeft?: number } | undefined)?.triesLeft;
          setTriesLeft(typeof left === "number" ? left : null);
          setError("Wrong PIN");
        } else if (e instanceof ApiClientError && e.code === "PIN_COOLDOWN") {
          const s = (e.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds ?? 30;
          setNow(Date.now());
          setCooldownUntil(Date.now() + s * 1000);
          setTriesLeft(null);
          setError("Too many tries");
        } else {
          setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
        }
      }
    },
    [vendor.id, qc, router],
  );

  const onChange = (next: string) => {
    if (busy || coolingDown) return;
    if (error && !coolingDown) setError(null);
    setPin(next);
    if (next.length === PIN_LENGTH) void submit(next);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-16 items-center gap-2 rounded-md px-3 text-body font-semibold text-ink-soft hover:bg-surface-sunk"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
          Change stall
        </button>
      </div>
      <VendorBadge vendor={vendor} size="lg" />
      <p className="text-body text-ink-soft" id="pin-label">
        Enter your 4-digit PIN
      </p>
      <PinPad value={pin} onChange={onChange} disabled={busy || coolingDown} error={!!error} shakeKey={shakeKey} />
      <div className="min-h-[56px] text-center" aria-live="assertive">
        {busy && (
          <span className="inline-flex items-center gap-2 text-body text-ink-soft">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Signing in…
          </span>
        )}
        {!busy && error && (
          <>
            <p className="inline-block rounded-sm bg-status-failed px-3 py-1 text-h2 font-bold text-status-failed-fg">{error}</p>
            {coolingDown ? (
              <p className="text-body text-ink-soft">
                Try again in <span className="tabular-nums font-semibold">{cooldownLeft}s</span>
              </p>
            ) : (
              triesLeft !== null && (
                <p className="text-body text-ink-soft">
                  {triesLeft} {triesLeft === 1 ? "try" : "tries"} left
                </p>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
