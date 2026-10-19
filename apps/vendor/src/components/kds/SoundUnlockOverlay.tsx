"use client";
import { Volume2 } from "lucide-react";
import { unlockAudio } from "@one/ui";

/** Browsers block audio until a tap. Shown after login/refresh when sound is on but locked. */
export function SoundUnlockOverlay({ onDone, onMute }: { onDone: () => void; onMute: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-paper/95 p-6" role="dialog" aria-modal="true" aria-labelledby="sound-unlock-title">
      <button
        type="button"
        autoFocus
        onClick={() => {
          void unlockAudio().finally(onDone);
        }}
        className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl bg-brand px-8 py-10 text-on-brand shadow-card focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        <Volume2 className="h-16 w-16" aria-hidden />
        <span id="sound-unlock-title" className="font-display text-h1 font-bold">
          Tap to enable sound
        </span>
        <span className="text-body">So you hear new orders arrive</span>
      </button>
      <button type="button" onClick={onMute} className="h-16 rounded-md px-6 text-body font-semibold text-ink-soft underline underline-offset-2 hover:bg-surface-sunk">
        Continue without sound
      </button>
    </div>
  );
}
