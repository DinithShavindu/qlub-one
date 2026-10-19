/** "2026-10-19" in the venue's timezone. */
export function dateKey(at: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}

export function isToday(iso: string, timeZone: string, now = new Date()): boolean {
  return dateKey(iso, timeZone) === dateKey(now, timeZone);
}

/** Lower bound for "today" queries: 36h back is always before local midnight, then filter with isToday. */
export function todayQueryFloor(now = new Date()): string {
  return new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
}

export function nowIso(): string {
  return new Date().toISOString();
}
