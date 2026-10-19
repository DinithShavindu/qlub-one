import { ACCENT_TOKENS, type AccentToken, type BulkVendorInput, type PosMode, type PosVendor } from "@one/contracts";

export const DEFAULT_EMOJI = "🍽️";

/** One row in the vendor preview table, before it is created. */
export interface VendorDraft {
  key: string;
  source: "pos" | "paste";
  name: string;
  emoji: string;
  posMode: PosMode;
  posVendorId: string | null;
  accentToken: AccentToken;
  /** 1-based paste line, for error messages */
  line?: number;
}

export interface PasteLineIssue {
  line: number;
  message: string;
}

export interface ParsedPaste {
  rows: Omit<VendorDraft, "accentToken">[];
  issues: PasteLineIssue[];
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;

/**
 * Parse "Name, emoji, pos|tablet" — one vendor per line.
 * Missing emoji → 🍽️. Missing mode → tablet. "pos" tries to match the POS directory by name.
 */
export function parsePaste(text: string, posDirectory: PosVendor[]): ParsedPaste {
  const rows: ParsedPaste["rows"] = [];
  const issues: PasteLineIssue[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim()) return;
    const parts = raw.split(",").map((p) => p.trim());
    const name = parts[0] ?? "";
    let emoji = "";
    let modeWord = "";
    for (const p of parts.slice(1)) {
      if (!p) continue;
      if (/^(pos|mock[ _-]?pos|tablet)$/i.test(p)) modeWord = p.toLowerCase();
      else if (EMOJI_RE.test(p) && !emoji) emoji = p;
      else issues.push({ line, message: `Line ${line}: "${p}" isn't an emoji or a mode (pos / tablet)` });
    }
    if (!name) {
      issues.push({ line, message: `Line ${line}: vendor name is missing` });
      return;
    }
    if (name.length > 40) {
      issues.push({ line, message: `Line ${line}: name is longer than 40 characters` });
      return;
    }
    const posMode: PosMode = modeWord && modeWord !== "tablet" ? "mock_pos" : "tablet";
    const match = posMode === "mock_pos" ? posDirectory.find((p) => p.displayName.toLowerCase() === name.toLowerCase()) : undefined;
    rows.push({
      key: `paste:${line}`,
      source: "paste",
      name,
      emoji: emoji || match?.emoji || DEFAULT_EMOJI,
      posMode,
      posVendorId: match?.posVendorId ?? null,
      line,
    });
  });
  return { rows, issues };
}

export function accentAt(index: number): AccentToken {
  return ACCENT_TOKENS[index % ACCENT_TOKENS.length]!;
}

/** Row-level problems keyed by draft key. Checks against existing venue vendor names too. */
export function validateDrafts(drafts: VendorDraft[], existingNames: string[]): Record<string, string> {
  const errs: Record<string, string> = {};
  const existing = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  const seen = new Map<string, string>();
  const seenPos = new Map<string, string>();
  for (const d of drafts) {
    const n = d.name.trim().toLowerCase();
    if (!n) errs[d.key] = "Name is required";
    else if (existing.has(n)) errs[d.key] = "A vendor with this name already exists in this venue";
    else if (seen.has(n)) errs[d.key] = "Duplicate name";
    else if (d.posMode === "mock_pos" && !d.posVendorId) errs[d.key] = "Pick which POS vendor this is, or switch to Tablet";
    else if (d.posMode === "mock_pos" && d.posVendorId && seenPos.has(d.posVendorId)) errs[d.key] = "This POS vendor is already used";
    if (n) seen.set(n, d.key);
    if (d.posMode === "mock_pos" && d.posVendorId) seenPos.set(d.posVendorId, d.key);
  }
  return errs;
}

export function toBulkInput(d: VendorDraft): BulkVendorInput {
  return {
    name: d.name.trim(),
    emoji: d.emoji.trim() || DEFAULT_EMOJI,
    posMode: d.posMode,
    ...(d.posMode === "mock_pos" && d.posVendorId ? { posVendorId: d.posVendorId } : {}),
    accentToken: d.accentToken,
  };
}
