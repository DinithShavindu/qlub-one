"use client";
import type { PasteLineIssue } from "@/lib/vendor-draft";

export const PASTE_PLACEHOLDER = "Shawarma Station, 🥙, pos\nBurger Lab, 🍔, tablet\nTaco Stand, 🌮, tablet";

export function BulkVendorPaste({ value, onChange, issues }: { value: string; onChange: (v: string) => void; issues: PasteLineIssue[] }) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h3 className="font-display text-body font-bold">Bulk paste</h3>
        <p className="text-small text-ink-muted">
          One vendor per line: <span className="font-mono">Name, emoji, pos|tablet</span>. No emoji → 🍽️.
        </p>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <label htmlFor="bulk-paste" className="sr-only">
          Vendors, one per line
        </label>
        <textarea
          id="bulk-paste"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={PASTE_PLACEHOLDER}
          rows={6}
          spellCheck={false}
          aria-describedby={issues.length ? "bulk-paste-issues" : undefined}
          className="min-h-[160px] w-full flex-1 resize-y rounded-md border border-line bg-paper p-3 font-mono text-small"
        />
        {issues.length > 0 && (
          <ul id="bulk-paste-issues" className="mt-2 flex flex-col gap-1 text-small text-status-failed-fg">
            {issues.map((i, k) => (
              <li key={k}>{i.message}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
