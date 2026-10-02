"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import DatabaseColumnPicker from "./DatabaseColumnPicker";

// Edit which tables and columns a CONNECTED database lets the AI read.
// The database is read live at question time, so saving takes effect
// immediately — nothing is re-indexed.
export default function DatabaseColumnsDialog({ source, onClose }) {
  const [schema, setSchema] = useState(null);
  const [allowed, setAllowed] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    setSchema(null);
    (async () => {
      const res = await fetch(`/api/sources/${source.id}/database-columns`);
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        toast.error(data.error || data.detail || "Couldn't read this database.");
        onClose();
        return;
      }
      setAllowed(Object.fromEntries(Object.entries(data.allowed || {}).map(([t, c]) => [t, new Set(c)])));
      setSchema(data.schema);
    })();
    return () => { cancelled = true; };
  }, [source, onClose]);

  const anySelected = Object.values(allowed).some((s) => s.size > 0);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/sources/${source.id}/database-columns`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowed: Object.fromEntries(Object.entries(allowed).map(([t, s]) => [t, [...s]])),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || data.detail || "Couldn't save.");
        return;
      }
      toast.success("Saved. The AI can only use the ticked columns.");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!source} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Tables the AI can use — {source?.label}</DialogTitle>
        </DialogHeader>
        {!schema ? (
          <div className="flex justify-center py-10">
            <Loader2 size={18} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <DatabaseColumnPicker schema={schema} allowed={allowed} onChange={setAllowed} />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !schema || !anySelected}>
            {saving ? <><Loader2 size={13} className="animate-spin mr-1" />Saving...</> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
