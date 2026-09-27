"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

function toState(tabs) {
  return (tabs || []).map(t => ({ ...t, hidden: new Set(t.hidden || []) }));
}

function toHiddenMap(tabs) {
  return Object.fromEntries(tabs.map(t => [t.tab, [...t.hidden]]));
}

// Which spreadsheet columns the bot may read and share. Anyone chatting
// with the bot can ask about ticked columns, so columns that look like
// personal data (emails, phone numbers) start unticked.
//
// Two modes:
// - `preview` ({title, tabs, skippedTabs, onConfirm}): shown when adding a
//   sheet/Excel file, BEFORE anything is indexed. onConfirm gets
//   {tab: [hidden columns]} and does the real connect.
// - `source`: an already-connected source; loads and saves its settings.
export default function SourceColumnsDialog({ source, preview, onClose }) {
  const [tabs, setTabs] = useState(null); // [{tab, columns, hidden: Set, row_count?}]
  const [saving, setSaving] = useState(false);
  const open = !!source || !!preview;

  useEffect(() => {
    if (preview) {
      setTabs(toState(preview.tabs));
      return;
    }
    if (!source) return;
    let cancelled = false;
    setTabs(null);
    (async () => {
      const res = await fetch(`/api/sources/${source.id}/columns`);
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        toast.error(data.error || data.detail || "Couldn't load this source's columns.");
        onClose();
        return;
      }
      setTabs(toState(data.tabs));
    })();
    return () => { cancelled = true; };
  }, [source, preview, onClose]);

  function toggle(tabName, col) {
    setTabs(prev => prev.map(t => {
      if (t.tab !== tabName) return t;
      const hidden = new Set(t.hidden);
      hidden.has(col) ? hidden.delete(col) : hidden.add(col);
      return { ...t, hidden };
    }));
  }

  async function confirm() {
    if (preview) {
      preview.onConfirm(toHiddenMap(tabs));
      onClose();
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/sources/${source.id}/columns`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabs: tabs.map(t => ({ tab: t.tab, hidden: [...t.hidden] })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || data.detail || "Couldn't save column settings.");
        return;
      }
      toast.success("Column settings saved.");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const title = preview ? preview.title : source?.label;
  const skipped = preview?.skippedTabs || [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose what the AI can use{title ? ` — ${title}` : ""}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-gray-500">
          Anyone chatting with your bot can ask about ticked columns. Columns that look like
          personal data (emails, phone numbers) start unticked — tick them only if customers
          should be able to see them.
        </p>
        {skipped.length > 0 && (
          <p className="text-xs text-amber-600">
            Not found, will be skipped: {skipped.map(t => `"${t}"`).join(", ")}
          </p>
        )}
        {!tabs ? (
          <div className="flex justify-center py-10">
            <Loader2 size={18} className="animate-spin text-gray-400" />
          </div>
        ) : tabs.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">
            No column information yet. Press Reload (or re-upload the file) once, then try again.
          </p>
        ) : (
          <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
            {tabs.map(t => (
              <div key={t.tab}>
                <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                  {t.tab === "default" ? "First tab" : t.tab}
                  <span className="text-xs font-normal text-gray-400 ml-2">
                    {t.columns.length - t.hidden.size}/{t.columns.length} columns
                    {typeof t.row_count === "number" ? ` · ${t.row_count.toLocaleString()} rows` : ""}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-2">
                  {t.columns.map(col => (
                    <label key={col} className="flex items-center gap-2 cursor-pointer py-0.5 min-w-0">
                      <input type="checkbox" checked={!t.hidden.has(col)} onChange={() => toggle(t.tab, col)} />
                      <span className="text-xs text-gray-700 truncate">{col}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={confirm} disabled={saving || !tabs?.length}>
            {saving
              ? <><Loader2 size={13} className="animate-spin mr-1" />Saving...</>
              : preview ? "Connect & Index" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
