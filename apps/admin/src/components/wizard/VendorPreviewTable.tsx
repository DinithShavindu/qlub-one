"use client";
import { cx } from "@/lib/cx";
import { X } from "lucide-react";
import { ACCENT_BG } from "@one/ui";
import { ACCENT_TOKENS, type PosVendor } from "@one/contracts";
import type { VendorDraft } from "@/lib/vendor-draft";

const cell = "h-9 rounded-md border border-line bg-surface px-2 text-small";

export function VendorPreviewTable({
  drafts,
  errors,
  posDirectory,
  onEdit,
  onRemove,
}: {
  drafts: VendorDraft[];
  errors: Record<string, string>;
  posDirectory: PosVendor[];
  onEdit: (key: string, patch: Partial<VendorDraft>) => void;
  onRemove: (d: VendorDraft) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <table className="w-full text-left text-small">
        <thead className="border-b border-line bg-surface-sunk text-micro uppercase text-ink-muted">
          <tr>
            <th className="w-20 px-3 py-2 font-semibold">Emoji</th>
            <th className="px-3 py-2 font-semibold">Name</th>
            <th className="px-3 py-2 font-semibold">Mode</th>
            <th className="px-3 py-2 font-semibold">POS vendor</th>
            <th className="px-3 py-2 font-semibold">Accent</th>
            <th className="w-12 px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {drafts.map((d) => {
            const err = errors[d.key];
            return (
              <tr key={d.key} className={cx("border-b border-line align-top last:border-0", err && "bg-status-failed/40")}>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Emoji for ${d.name || "vendor"}`}
                    className={cx(cell, "w-14 text-center text-base")}
                    value={d.emoji}
                    maxLength={8}
                    onChange={(e) => onEdit(d.key, { emoji: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label="Vendor name"
                    aria-invalid={!!err}
                    className={cx(cell, "w-full font-semibold", err && "border-status-failed-fg")}
                    value={d.name}
                    maxLength={40}
                    onChange={(e) => onEdit(d.key, { name: e.target.value })}
                  />
                  {err && <p className="mt-1 text-small text-status-failed-fg">{err}</p>}
                  {d.source === "paste" && <p className="mt-1 text-micro uppercase text-ink-muted">Pasted · line {d.line}</p>}
                </td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Mode for ${d.name || "vendor"}`}
                    className={cell}
                    value={d.posMode}
                    onChange={(e) => {
                      const posMode = e.target.value as VendorDraft["posMode"];
                      onEdit(d.key, { posMode, posVendorId: posMode === "tablet" ? null : d.posVendorId });
                    }}
                  >
                    <option value="mock_pos">Mock POS</option>
                    <option value="tablet">Tablet</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  {d.posMode === "mock_pos" ? (
                    <select
                      aria-label={`POS vendor for ${d.name || "vendor"}`}
                      className={cx(cell, "font-mono", !d.posVendorId && "border-status-failed-fg")}
                      value={d.posVendorId ?? ""}
                      onChange={(e) => onEdit(d.key, { posVendorId: e.target.value || null })}
                    >
                      <option value="">Choose…</option>
                      {posDirectory.map((p) => (
                        <option key={p.posVendorId} value={p.posVendorId}>
                          {p.posVendorId} · {p.displayName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="inline-block py-2 text-ink-muted">Kitchen tablet</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div role="radiogroup" aria-label={`Accent for ${d.name || "vendor"}`} className="flex gap-1 py-1.5">
                    {ACCENT_TOKENS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={d.accentToken === t}
                        aria-label={t}
                        onClick={() => onEdit(d.key, { accentToken: t })}
                        className={cx(
                          "h-5 w-5 rounded-full ring-offset-2 ring-offset-surface",
                          ACCENT_BG[t],
                          d.accentToken === t ? "ring-2 ring-ink" : "opacity-60 hover:opacity-100",
                        )}
                      />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(d)}
                    aria-label={`Remove ${d.name || "vendor"}`}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunk hover:text-ink"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
