"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
  "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
  "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal",
];
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMPTY = { legal_name: "", gstin: "", registered_address: "", state: "" };

// Seller details printed on invoices. Saved through the backend (which
// validates the GSTIN), separately from the "Save Settings" button.
// Changes apply to new invoices only: issued ones keep their details.
export default function TaxInvoiceCard({ projectId, isAdmin }) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/shop-config/${projectId}/invoice`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, d[k] || ""])));
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const gstin = form.gstin.trim().toUpperCase();
  const gstinBad = gstin !== "" && !GSTIN_RE.test(gstin);

  const save = async () => {
    if (gstinBad) {
      toast.error("GSTIN must be 15 characters, like 29ABCDE1234F1Z5");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/shop-config/${projectId}/invoice`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, gstin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Couldn't save the invoice details.");
        return;
      }
      setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, data[k] || ""])));
      toast.success("Invoice details saved");
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving || !isAdmin;
  return (
    <Card className="md:col-span-2">
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900">Tax invoice</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Printed on every order&apos;s invoice. With a GSTIN it is a GST tax invoice; without one, a receipt.
            A branch can override these in its own settings. Changes apply to new invoices only.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Legal business name</label>
            <Input value={form.legal_name} disabled={disabled} maxLength={200}
              placeholder="As on your GST registration" onChange={(e) => set("legal_name", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">GSTIN</label>
            <Input value={form.gstin} disabled={disabled} maxLength={15} placeholder="e.g. 29ABCDE1234F1Z5"
              onChange={(e) => set("gstin", e.target.value.toUpperCase())} />
            {gstinBad && <p className="text-xs text-red-600 mt-1">15 characters, like 29ABCDE1234F1Z5</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Registered address</label>
            <textarea rows={2} maxLength={500} disabled={disabled}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200 resize-none"
              value={form.registered_address} onChange={(e) => set("registered_address", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">State</label>
            <Input list="zv-in-states" value={form.state} disabled={disabled} maxLength={60}
              placeholder="e.g. Karnataka" onChange={(e) => set("state", e.target.value)} />
            <datalist id="zv-in-states">
              {STATES.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>
        {isAdmin ? (
          <Button size="sm" onClick={save} disabled={disabled || gstinBad}>
            {saving ? <><Loader2 size={14} className="animate-spin mr-2" />Saving...</> : "Save invoice details"}
          </Button>
        ) : (
          <p className="text-xs text-gray-400">Only admins can change these.</p>
        )}
      </CardContent>
    </Card>
  );
}
