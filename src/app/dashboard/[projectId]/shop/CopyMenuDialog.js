"use client";

import { useEffect, useState } from "react";
import { X, Loader2, AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Copy all catalogs + items from another branch into `target`.
// append = keep what's there and add; replace = delete target's own
// (non-Shopify) catalogs first, then copy.
export default function CopyMenuDialog({ open, target, branches, onClose, onCopied }) {
  const sources = (branches || []).filter(b => target && b.id !== target.id);
  const [sourceId, setSourceId] = useState("");
  const [mode, setMode] = useState("append");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    const firstWithMenu = sources.find(b => (b.catalog_count || 0) > 0) || sources[0];
    setSourceId(firstWithMenu?.id || "");
    setMode("append");
    setError(null);
  }, [open, target?.id]); // reset only when the dialog opens for a target

  if (!open || !target) return null;

  const source = sources.find(b => b.id === sourceId);
  const targetCount = target.catalog_count || 0;
  const sourceCount = source?.catalog_count || 0;

  const submit = async () => {
    if (!source) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/shop-branches/${target.id}/copy-menu`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_branch_id: source.id, mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't copy the menu.");
        return;
      }
      toast.success(`Copied ${plural(data.catalogs_copied ?? 0, "catalog", "catalogs")} · ${plural(data.products_copied ?? 0, "item", "items")}`);
      onCopied?.(data);
      onClose();
    } catch (e) {
      console.error(e);
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-gray-900">Copy menu into <span className="text-indigo-700">{target.name}</span></h3>
          <button onClick={onClose} disabled={saving} aria-label="Close"><X size={18} /></button>
        </div>

        {sources.length === 0 ? (
          <p className="text-sm text-gray-500">Add another branch first. Then you can copy its menu here in one click.</p>
        ) : (
          <>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Copy from</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                value={sourceId} onChange={e => setSourceId(e.target.value)} disabled={saving}>
                {sources.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({plural(b.catalog_count || 0, "catalog", "catalogs")})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className={`flex items-start gap-2 border rounded-lg p-3 cursor-pointer ${mode === "append" ? "border-indigo-300 bg-indigo-50/40" : ""}`}>
                <input type="radio" name="copy-mode" className="mt-1" checked={mode === "append"}
                  onChange={() => setMode("append")} disabled={saving} />
                <span>
                  <span className="text-sm font-medium text-gray-800 block">Add to existing menu</span>
                  <span className="text-xs text-gray-500">
                    {targetCount > 0
                      ? `Keeps the ${plural(targetCount, "catalog", "catalogs")} already in ${target.name} and adds the copied ones next to them.`
                      : `${target.name} has no menu yet, so this simply copies it in.`}
                  </span>
                </span>
              </label>
              <label className={`flex items-start gap-2 border rounded-lg p-3 cursor-pointer ${mode === "replace" ? "border-red-300 bg-red-50/40" : ""}`}>
                <input type="radio" name="copy-mode" className="mt-1" checked={mode === "replace"}
                  onChange={() => setMode("replace")} disabled={saving} />
                <span>
                  <span className="text-sm font-medium text-gray-800 block">Replace existing menu</span>
                  <span className="text-xs text-gray-500">Removes {target.name}'s current menu first, so nothing is duplicated.</span>
                </span>
              </label>
            </div>

            {mode === "replace" && targetCount > 0 && (
              <p className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Deletes {plural(targetCount, "catalog", "catalogs")} (and all their items) in {target.name}. Shopify-synced catalogs are kept. This cannot be undone.
              </p>
            )}

            {source && sourceCount === 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                {source.name} has no menu yet, so there's nothing to copy.
              </p>
            )}

            <p className="text-xs text-gray-400">
              Images are reused by link. Shopify-synced items are copied as normal items and won't auto-sync.
              Each branch's menu is separate after copying, so you can change prices or mark items unavailable per branch.
            </p>
          </>
        )}

        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} disabled={saving}
            className="flex-1 border rounded-lg px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !source || sourceCount === 0}
            className={`flex-1 flex items-center justify-center gap-1.5 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50 ${
              mode === "replace" ? "bg-red-600 hover:bg-red-700" : "bg-gray-900 hover:bg-gray-800"
            }`}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
            {mode === "replace" ? "Replace menu" : "Copy menu"}
          </button>
        </div>
      </div>
    </div>
  );
}
