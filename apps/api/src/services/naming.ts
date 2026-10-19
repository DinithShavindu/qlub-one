import { ACCENT_TOKENS, type AccentToken } from "@one/contracts";
import { slugify } from "@one/db";

/**
 * Pickup-code letter, unique per venue. Tries the slug's first letter, then word initials,
 * then any letter in the name, then the alphabet.
 */
export function assignLetter(name: string, used: Set<string>): string {
  const slug = slugify(name);
  const words = name.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const candidates = [
    slug[0]?.toUpperCase(),
    ...words.map((w) => w[0]),
    ...name.toUpperCase().replace(/[^A-Z]/g, "").split(""),
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  ].filter((c): c is string => !!c && /^[A-Z]$/.test(c));
  for (const c of candidates) if (!used.has(c)) return c;
  // >26 vendors: reuse letters (codes still unique by vendor + counter)
  return candidates[0] ?? "X";
}

/** Short uppercase venue code for vendor login: first word, then initials, then first word + n. */
export function venueCodeCandidates(name: string): string[] {
  const words = name.toUpperCase().replace(/\(.*?\)/g, "").split(/[^A-Z0-9]+/).filter(Boolean);
  const first = (words[0] ?? "VENUE").slice(0, 10);
  const initials = words.map((w) => w[0]).join("").slice(0, 6);
  const out = [first];
  if (initials.length >= 2) out.push(initials);
  for (let i = 2; i < 100; i++) out.push(`${first}${i}`);
  return out;
}

export function accentFor(index: number): AccentToken {
  return ACCENT_TOKENS[index % ACCENT_TOKENS.length]!;
}

export function uniqueSlug(name: string, used: Set<string>): string {
  const base = slugify(name);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}
