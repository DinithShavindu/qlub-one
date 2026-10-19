"use client";
/** Web Audio helpers. Browsers (iOS especially) need `unlockAudio()` from a user tap first. */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

export async function unlockAudio(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  if (c.state === "suspended") await c.resume().catch(() => undefined);
  // play a silent blip so iOS considers audio unlocked
  const o = c.createOscillator();
  const g = c.createGain();
  g.gain.value = 0;
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.01);
  return c.state === "running";
}

export function isAudioUnlocked(): boolean {
  return ctx?.state === "running";
}

function tone(c: AudioContext, freq: number, start: number, durMs: number, volume = 0.25) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(volume, start + 0.01);
  g.gain.setValueAtTime(volume, start + durMs / 1000 - 0.02);
  g.gain.linearRampToValueAtTime(0, start + durMs / 1000);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + durMs / 1000 + 0.02);
}

/** KDS new order: two short beeps, 880Hz, 120ms. */
export function playNewOrderBeeps() {
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const t = c.currentTime;
  tone(c, 880, t, 120);
  tone(c, 880, t + 0.22, 120);
}

/** Guest "ready" chime: rising two-note. */
export function playReadyChime() {
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const t = c.currentTime;
  tone(c, 660, t, 160, 0.2);
  tone(c, 990, t + 0.18, 260, 0.2);
}

export function vibrate(ms = 200) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
}
