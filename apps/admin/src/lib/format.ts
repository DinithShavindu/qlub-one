/** 102 -> "01:42"; 3725 -> "1:02:05" — for the live setup timer chip. */
export function formatTimer(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${String(m).padStart(2, "0")}:${sec}`;
}

/** 222 -> "3m 42s", null -> "—" */
export function formatPrep(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

export function baselineLine(vendorCount: number, baselineMinPerVendor: number): string {
  const total = Math.round(vendorCount * baselineMinPerVendor);
  const human = total >= 120 ? `${total} min (${Math.round((total / 60) * 10) / 10} h)` : `${total} min`;
  return `vs ~${human} as ${vendorCount} separate restaurant${vendorCount === 1 ? "" : "s"}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
