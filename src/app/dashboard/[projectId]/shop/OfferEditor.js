"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Loader2, Percent, Banknote, Truck, Sparkles, Info, Eye } from "lucide-react";
import { toast } from "sonner";

// Shared contract (spec B.2 / A): codes are stored upper-case, 4–20 chars.
export const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{3,19}$/;

const KINDS = [
  { id: "percent", label: "% off", icon: Percent, hint: "A percentage of the item total" },
  { id: "flat", label: "Flat off", icon: Banknote, hint: "A fixed amount off the item total" },
  { id: "free_delivery", label: "Free delivery", icon: Truck, hint: "Waives the delivery fee" },
];

const FULFILMENTS = [
  ["any", "Pickup & delivery"],
  ["pickup", "Pickup only"],
  ["delivery", "Delivery only"],
];

// ── Money / numbers ──────────────────────────────────────────
export function fmtAmount(v) {
  const n = Number(v || 0);
  return Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const numOrNull = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const intOrNull = (v) => {
  const n = numOrNull(v);
  return n == null ? null : Math.round(n);
};

// Same rules as backend shop_rules.offer_label, so the preview matches what
// customers see. The saved offer's server `label` is what the list shows.
export function offerLabel(o, currency = "₹") {
  let s;
  if (o.kind === "percent") {
    s = `${fmtAmount(o.value)}% off`;
    if (Number(o.max_discount) > 0) s += ` up to ${currency}${fmtAmount(o.max_discount)}`;
  } else if (o.kind === "flat") {
    s = `${currency}${fmtAmount(o.value)} off`;
  } else {
    s = "Free delivery";
  }
  if (Number(o.min_order_value) > 0) s += ` on orders above ${currency}${fmtAmount(o.min_order_value)}`;
  if (o.first_order_only) s += " · first order";
  if (o.application === "code" && o.is_visible && o.code) s += ` · use ${o.code}`;
  if (o.application === "automatic") s += " · auto-applied";
  return s;
}

export function normalizeCodeInput(raw) {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20);
}

// 8 chars, no look-alikes (0/O, 1/I).
function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

// ── Time zones (datetime-local <-> ISO UTC in the branch timezone) ──
function zoneParts(ms, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t) => Number(parts.find(p => p.type === t)?.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute"), s: get("second") };
}
function zoneOffsetMs(ms, timeZone) {
  const p = zoneParts(ms, timeZone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

// "2026-11-01T23:59" in timeZone -> "2026-11-01T18:29:00.000Z"
export function localToUtcIso(local, timeZone) {
  const m = String(local || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  try {
    let utc = guess - zoneOffsetMs(guess, timeZone);
    utc = guess - zoneOffsetMs(utc, timeZone); // DST edge
    return new Date(utc).toISOString();
  } catch {
    return new Date(guess).toISOString();
  }
}

// ISO -> "YYYY-MM-DDTHH:mm" in timeZone (for datetime-local inputs)
export function utcIsoToLocal(iso, timeZone) {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  try {
    const p = zoneParts(ms, timeZone);
    const pad = (n) => String(n).padStart(2, "0");
    return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
  } catch {
    return "";
  }
}

export function formatInZone(iso, timeZone) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const opts = { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true };
  try { return d.toLocaleString("en-IN", { ...opts, timeZone }); } catch { return d.toLocaleString("en-IN", opts); }
}

// ── Form <-> payload ─────────────────────────────────────────
const str = (v) => (v == null ? "" : String(Number(v)));

function toForm(o, timeZone, { duplicate = false } = {}) {
  return {
    title: o ? (duplicate ? `${o.title} (copy)`.slice(0, 60) : o.title || "") : "",
    description: o?.description || "",
    kind: o?.kind || "percent",
    value: o && o.kind !== "free_delivery" ? str(o.value) : "",
    max_discount: o?.max_discount == null ? "" : str(o.max_discount),
    min_order_value: o && Number(o.min_order_value) > 0 ? str(o.min_order_value) : "",
    application: o?.application || "automatic",
    code: o && !duplicate ? o.code || "" : "",
    is_visible: o ? o.is_visible !== false : true,
    starts_at: utcIsoToLocal(o?.starts_at, timeZone),
    ends_at: utcIsoToLocal(o?.ends_at, timeZone),
    is_active: o ? (duplicate ? false : o.is_active !== false) : true,
    all_branches: !(o?.branch_ids || []).length,
    branch_ids: o?.branch_ids || [],
    fulfilment: o?.fulfilment || "any",
    first_order_only: !!o?.first_order_only,
    usage_limit: o?.usage_limit == null ? "" : String(o.usage_limit),
    per_customer_limit: o?.per_customer_limit == null ? "" : String(o.per_customer_limit),
  };
}

function toPayload(f, timeZone) {
  const free = f.kind === "free_delivery";
  const isCode = f.application === "code";
  return {
    title: f.title.trim(),
    description: f.description.trim() || null,
    kind: f.kind,
    value: free ? 0 : numOrNull(f.value),
    max_discount: f.kind === "percent" ? numOrNull(f.max_discount) : null,
    min_order_value: numOrNull(f.min_order_value) || 0,
    application: f.application,
    code: isCode ? normalizeCodeInput(f.code) || null : null,
    is_visible: isCode ? !!f.is_visible : true,
    starts_at: f.starts_at ? localToUtcIso(f.starts_at, timeZone) : null,
    ends_at: f.ends_at ? localToUtcIso(f.ends_at, timeZone) : null,
    is_active: !!f.is_active,
    branch_ids: f.all_branches ? [] : f.branch_ids,
    fulfilment: free ? "delivery" : f.fulfilment,
    first_order_only: !!f.first_order_only,
    usage_limit: intOrNull(f.usage_limit),
    per_customer_limit: intOrNull(f.per_customer_limit),
  };
}

// Client-side checks mirror the DB / backend rules so most mistakes are
// caught before saving. The server re-validates everything.
function validate(p, { isNew }) {
  const e = {};
  if (!p.title) e.title = "Give the offer a name.";
  else if (p.title.length > 60) e.title = "Keep the name under 60 characters.";
  if (p.description && p.description.length > 200) e.description = "Keep the description under 200 characters.";
  if (p.kind === "percent" && !(p.value > 0 && p.value <= 100)) e.value = "Enter a percentage between 1 and 100.";
  if (p.kind === "flat" && !(p.value > 0 && p.value <= 100000)) e.value = "Enter an amount above 0.";
  if (p.max_discount != null && !(p.max_discount > 0 && p.max_discount <= 100000)) e.max_discount = "Enter an amount above 0, or leave it empty.";
  if (!(p.min_order_value >= 0)) e.min_order_value = "Enter 0 or more.";
  if (p.application === "code") {
    if (!p.code) e.code = "Enter a code, or tap Generate.";
    else if (!CODE_RE.test(p.code)) e.code = "4–20 characters: letters, numbers, - or _ (must start with a letter or number).";
    else if (!p.is_visible && p.code.length < 6) e.code = "Secret codes need at least 6 characters so they can't be guessed.";
  }
  if (p.starts_at && p.ends_at && Date.parse(p.ends_at) <= Date.parse(p.starts_at)) e.ends_at = "The end must be after the start.";
  else if (isNew && p.ends_at && Date.parse(p.ends_at) <= Date.now()) e.ends_at = "The end time is already in the past.";
  if (p.usage_limit != null && !(p.usage_limit >= 1 && p.usage_limit <= 1000000)) e.usage_limit = "Enter a number from 1, or leave it empty.";
  if (p.per_customer_limit != null && !(p.per_customer_limit >= 1 && p.per_customer_limit <= 1000)) e.per_customer_limit = "Enter 1–1000, or leave it empty.";
  return e;
}

function FieldError({ text }) {
  return text ? <p className="text-xs text-red-600 mt-1">{text}</p> : null;
}

function SectionTitle({ n, children }) {
  return (
    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[11px] flex items-center justify-center">{n}</span>
      {children}
    </h4>
  );
}

function RadioCard({ active, disabled, onClick, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`text-left border rounded-xl px-3 py-2.5 transition-all ${
        active ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900" : "border-gray-200 bg-white hover:border-gray-400"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
      {children}
    </button>
  );
}

// open: boolean; offer: existing offer (edit / duplicate source) or null;
// mode: "new" | "edit" | "duplicate"
export default function OfferEditor({
  open, mode = "new", offer, projectId, branches = [], currency = "₹",
  timeZone = "Asia/Kolkata", onClose, onSaved,
}) {
  const isEdit = mode === "edit" && !!offer;
  const isNew = !isEdit;
  const [form, setForm] = useState(() => toForm(offer, timeZone, { duplicate: mode === "duplicate" }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const setField = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const payload = toPayload(form, timeZone);
  const preview = offerLabel(payload, currency);
  const free = form.kind === "free_delivery";
  const multiBranch = branches.length > 1;
  const needsIdentity = form.first_order_only || form.per_customer_limit !== "";

  const setKind = (kind) => {
    setForm(f => ({ ...f, kind, fulfilment: kind === "free_delivery" ? "delivery" : f.fulfilment }));
    setErrors(e => ({ ...e, value: undefined, max_discount: undefined }));
  };

  const toggleBranch = (id) => {
    setForm(f => {
      const has = f.branch_ids.includes(id);
      return { ...f, branch_ids: has ? f.branch_ids.filter(x => x !== id) : [...f.branch_ids, id] };
    });
  };

  const save = async () => {
    const p = toPayload(form, timeZone);
    const errs = validate(p, { isNew });
    if (!form.all_branches && p.branch_ids.length === 0) errs.branches = "Pick at least one branch, or choose All branches.";
    setErrors(errs);
    setFormError(null);
    if (Object.values(errs).some(Boolean)) return;

    setSaving(true);
    try {
      let res;
      if (isNew) {
        res = await fetch("/api/shop-offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId, ...p }),
        });
      } else {
        // Only changed keys (the backend's PUT is partial; null clears).
        const before = toPayload(toForm(offer, timeZone), timeZone);
        const changes = Object.fromEntries(
          Object.entries(p).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k]))
        );
        if (Object.keys(changes).length === 0) { onClose(); return; }
        res = await fetch(`/api/shop-offers/${offer.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "code_taken") {
          setErrors(e => ({ ...e, code: data.error || "Another offer already uses this code." }));
        } else {
          setFormError(data.error || "Couldn't save this offer.");
        }
        return;
      }
      toast.success(isNew ? "Offer created" : "Offer saved", data?.label ? { description: data.label } : undefined);
      onSaved?.(data);
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-200";

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 gap-0 overflow-y-auto">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle>{isEdit ? "Edit offer" : mode === "duplicate" ? "Duplicate offer" : "Create offer"}</SheetTitle>
          <SheetDescription>One offer applies per order — customers always get the best one they qualify for.</SheetDescription>
        </SheetHeader>

        <div className="px-5 py-5 space-y-6">
          {/* Name */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Offer name *</label>
              <Input placeholder="e.g. Welcome 10%" maxLength={60}
                value={form.title} onChange={e => setField("title", e.target.value)} />
              <FieldError text={errors.title} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
              <Input placeholder="Shown to customers with the offer" maxLength={200}
                value={form.description} onChange={e => setField("description", e.target.value)} />
              <FieldError text={errors.description} />
            </div>
          </div>

          {/* 1. Type */}
          <div className="space-y-3">
            <SectionTitle n={1}>Type</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map(k => {
                const Icon = k.icon;
                return (
                  <RadioCard key={k.id} active={form.kind === k.id} onClick={() => setKind(k.id)}>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                      <Icon size={14} /> {k.id === "flat" ? `${currency} flat off` : k.label}
                    </span>
                    <span className="block text-[11px] text-gray-400 mt-0.5 leading-tight">{k.hint}</span>
                  </RadioCard>
                );
              })}
            </div>
            {!free && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    {form.kind === "percent" ? "Discount (%) *" : `Discount (${currency}) *`}
                  </label>
                  <Input type="number" min="0" max={form.kind === "percent" ? 100 : 100000} step="any"
                    placeholder={form.kind === "percent" ? "10" : "50"}
                    value={form.value} onChange={e => setField("value", e.target.value)} />
                  <FieldError text={errors.value} />
                </div>
                {form.kind === "percent" && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Maximum discount ({currency})</label>
                    <Input type="number" min="0" step="any" placeholder="No cap"
                      value={form.max_discount} onChange={e => setField("max_discount", e.target.value)} />
                    <FieldError text={errors.max_discount} />
                  </div>
                )}
              </div>
            )}
            {free && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                Waives the delivery fee on delivery orders. GST is unchanged.
              </p>
            )}
          </div>

          {/* 2. How customers get it */}
          <div className="space-y-3">
            <SectionTitle n={2}>How customers get it</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <RadioCard active={form.application === "automatic"} onClick={() => setField("application", "automatic")}>
                <span className="text-sm font-medium text-gray-900">Automatic</span>
                <span className="block text-[11px] text-gray-400 mt-0.5 leading-tight">Applied by itself when the cart qualifies</span>
              </RadioCard>
              <RadioCard active={form.application === "code"} onClick={() => setField("application", "code")}>
                <span className="text-sm font-medium text-gray-900">Coupon code</span>
                <span className="block text-[11px] text-gray-400 mt-0.5 leading-tight">Customers type a code at checkout</span>
              </RadioCard>
            </div>
            {form.application === "code" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Code *</label>
                  <div className="flex gap-2">
                    <Input className="font-mono uppercase tracking-wide" placeholder="WELCOME10" maxLength={20}
                      autoCapitalize="characters" spellCheck={false}
                      value={form.code} onChange={e => setField("code", normalizeCodeInput(e.target.value))} />
                    <Button type="button" variant="outline" onClick={() => setField("code", generateCode())}>
                      <Sparkles size={13} className="mr-1" /> Generate
                    </Button>
                  </div>
                  <FieldError text={errors.code} />
                  {!errors.code && <p className="text-xs text-gray-400 mt-1">Letters, numbers, - and _ · 4–20 characters</p>}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Show this code on the menu page</p>
                    <p className="text-xs text-gray-400">
                      {form.is_visible ? "Customers see it in the offers strip" : "Secret code — only people you share it with can use it (6+ characters)"}
                    </p>
                  </div>
                  <Switch checked={form.is_visible} onCheckedChange={on => setField("is_visible", on)} />
                </div>
              </div>
            )}
          </div>

          {/* 3. Conditions */}
          <div className="space-y-3">
            <SectionTitle n={3}>Conditions</SectionTitle>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Minimum order value ({currency})</label>
              <Input type="number" min="0" step="any" placeholder="No minimum"
                value={form.min_order_value} onChange={e => setField("min_order_value", e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Item total before the discount</p>
              <FieldError text={errors.min_order_value} />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Order type</label>
              <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit flex-wrap">
                {FULFILMENTS.map(([id, label]) => {
                  const disabled = free && id !== "delivery";
                  const active = (free ? "delivery" : form.fulfilment) === id;
                  return (
                    <button key={id} type="button" disabled={disabled} onClick={() => setField("fulfilment", id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        active ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
                      {label}
                    </button>
                  );
                })}
              </div>
              {free && <p className="text-xs text-gray-400 mt-1">Free delivery only applies to delivery orders.</p>}
            </div>

            {multiBranch && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Branches</label>
                <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
                  {[[true, "All branches"], [false, "Selected branches"]].map(([all, label]) => (
                    <button key={label} type="button"
                      onClick={() => { setField("all_branches", all); setErrors(e => ({ ...e, branches: undefined })); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        form.all_branches === all ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                {!form.all_branches && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {branches.map(b => (
                      <label key={b.id} className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={form.branch_ids.includes(b.id)} onChange={() => toggleBranch(b.id)} />
                        <span className="truncate">{b.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                <FieldError text={errors.branches} />
              </div>
            )}

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={form.first_order_only}
                onChange={e => setField("first_order_only", e.target.checked)} />
              <span>
                <span className="text-sm font-medium text-gray-700 block">First order only</span>
                <span className="text-xs text-gray-400">Only for customers who haven't ordered from you before</span>
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Total uses limit</label>
                <Input type="number" min="1" step="1" placeholder="Unlimited"
                  value={form.usage_limit} onChange={e => setField("usage_limit", e.target.value)} />
                <FieldError text={errors.usage_limit} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Uses per customer</label>
                <Input type="number" min="1" max="1000" step="1" placeholder="Unlimited"
                  value={form.per_customer_limit} onChange={e => setField("per_customer_limit", e.target.value)} />
                <FieldError text={errors.per_customer_limit} />
              </div>
            </div>

            {needsIdentity && (
              <p className="flex items-start gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <Info size={12} className="mt-0.5 shrink-0" />
                Works only for customers who open the menu from your WhatsApp messages (verified).
              </p>
            )}
          </div>

          {/* 4. Schedule */}
          <div className="space-y-3">
            <SectionTitle n={4}>Schedule</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Starts (optional)</label>
                <input type="datetime-local" className={inputCls}
                  value={form.starts_at} onChange={e => setField("starts_at", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Ends (optional)</label>
                <input type="datetime-local" className={inputCls}
                  value={form.ends_at} onChange={e => setField("ends_at", e.target.value)} />
                <FieldError text={errors.ends_at} />
              </div>
            </div>
            <p className="text-xs text-gray-400">Times are in {timeZone}. Leave empty to start now and never end.</p>
          </div>

          {/* 5. Active */}
          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Offer is active</p>
              <p className="text-xs text-gray-400">Turn off to pause it without deleting</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={on => setField("is_active", on)} />
          </div>

          {/* 6. Preview */}
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-green-700 font-semibold flex items-center gap-1">
              <Eye size={11} /> What customers see
            </p>
            <p className="text-sm text-green-900 mt-1">
              🏷️ {preview}
            </p>
            {form.application === "code" && !form.is_visible && (
              <p className="text-xs text-green-700 mt-1">Hidden from the menu — shown only after the customer types the code.</p>
            )}
          </div>

          {formError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <><Loader2 size={14} className="animate-spin mr-2" />Saving...</> : isEdit ? "Save offer" : "Create offer"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
