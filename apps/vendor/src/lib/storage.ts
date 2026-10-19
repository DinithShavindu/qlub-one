/** localStorage wrappers that never throw (private mode, blocked storage, SSR). */
export const STORAGE_KEYS = {
  theme: "kds-theme",
  sound: "kds-sound",
  venueCode: "kds-venue-code",
  vendorFilter: "panel-vendor-filter",
} as const;

export function readStorage(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
