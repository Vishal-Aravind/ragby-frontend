"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Copy, Trash2, Loader2, Tag, ClipboardList, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirmDialog";
import OfferEditor, { offerLabel, fmtAmount, formatInZone } from "./OfferEditor";
import OfferRedemptionsDrawer from "./OfferRedemptionsDrawer";

// Offer `state` comes from the server (shared contract).
const STATE_BADGE = {
  active: ["Active", "bg-green-50 text-green-700 border-green-200"],
  scheduled: ["Scheduled", "bg-blue-50 text-blue-700 border-blue-200"],
  paused: ["Paused", "bg-gray-100 text-gray-600 border-gray-200"],
  expired: ["Expired", "bg-gray-100 text-gray-500 border-gray-200"],
  limit_reached: ["Limit reached", "bg-amber-50 text-amber-700 border-amber-200"],
  archived: ["Archived", "bg-gray-50 text-gray-400 border-gray-200"],
};

// "Expired" also lists fully-claimed offers: both have stopped applying.
const FILTERS = [
  ["all", "All", (o) => o.state !== "archived"],
  ["active", "Active", (o) => o.state === "active"],
  ["scheduled", "Scheduled", (o) => o.state === "scheduled"],
  ["paused", "Paused", (o) => o.state === "paused"],
  ["expired", "Expired", (o) => o.state === "expired" || o.state === "limit_reached"],
  ["archived", "Archived", (o) => o.state === "archived"],
];

function conditionsLine(o, { currency, branchNameById, multiBranch, timeZone }) {
  const parts = [];
  if (Number(o.min_order_value) > 0) parts.push(`Min ${currency}${fmtAmount(o.min_order_value)}`);
  if (o.fulfilment === "delivery") parts.push("Delivery only");
  else if (o.fulfilment === "pickup") parts.push("Pickup only");
  if (multiBranch && (o.branch_ids || []).length) {
    parts.push(o.branch_ids.map(id => branchNameById[id] || "Removed branch").join(", "));
  }
  if (o.first_order_only) parts.push("First order");
  if (o.per_customer_limit) parts.push(`${o.per_customer_limit} per customer`);
  if (o.starts_at && Date.parse(o.starts_at) > Date.now()) parts.push(`starts ${formatInZone(o.starts_at, timeZone)}`);
  if (o.ends_at) parts.push(`${Date.parse(o.ends_at) > Date.now() ? "ends" : "ended"} ${formatInZone(o.ends_at, timeZone)}`);
  return parts.join(" · ");
}

function UsageLine({ o, currency }) {
  const u = o.usage || {};
  const used = Number(u.confirmed || 0);
  const held = Number(u.held || 0);
  const given = Number(u.total_discount || 0);
  return (
    <p className="text-xs text-gray-500">
      <strong className="text-gray-800">{used.toLocaleString("en-IN")} used</strong>
      {o.usage_limit ? <> of {Number(o.usage_limit).toLocaleString("en-IN")}</> : null}
      {held > 0 && <> · {held} awaiting payment</>}
      {given > 0 && <> · {currency}{fmtAmount(given)} given</>}
    </p>
  );
}

export default function OffersPanel({
  projectId, branches = [], isAdmin, currency = "₹", defaultTimezone = "Asia/Kolkata", onOffersChange,
}) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  // { mode: "new" | "edit" | "duplicate", offer, key }
  const [editor, setEditor] = useState(null);
  const [viewing, setViewing] = useState(null);
  const editorKey = useRef(0);

  const multiBranch = branches.length > 1;
  const branchNameById = Object.fromEntries(branches.map(b => [b.id, b.name]));

  const updateOffers = (next) => {
    setOffers(next);
    onOffersChange?.(next);
  };

  const fetchOffers = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/shop-offers?project_id=${projectId}&include_archived=true`);
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) {
        updateOffers(data);
        setError(null);
      } else {
        setError(data?.error || "Couldn't load your offers.");
      }
    } catch {
      setError("Couldn't load your offers. Check your connection and try again.");
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { if (projectId) fetchOffers(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEditor = (mode, offer = null) => {
    editorKey.current += 1;
    setEditor({ mode, offer, key: editorKey.current });
  };

  const togglePause = async (o) => {
    setBusyId(o.id);
    try {
      const res = await fetch(`/api/shop-offers/${o.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !o.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || "Couldn't update this offer."); return; }
      updateOffers(offers.map(x => (x.id === o.id ? { ...x, ...data } : x)));
      toast.success(o.is_active ? `${o.title} paused` : `${o.title} is live again`);
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (o) => {
    const used = Number(o.usage?.confirmed || 0) + Number(o.usage?.held || 0);
    const ok = await confirmDialog({
      title: `Delete ${o.title}?`,
      description: used > 0
        ? "This offer has already been used, so it will be archived: it stops applying, and past orders keep their discount."
        : "Customers won't be able to use it any more. This cannot be undone.\n\nTo stop it for a while instead, pause it.",
      confirmText: "Delete offer",
      cancelText: "Keep it",
    });
    if (!ok) return;
    setBusyId(o.id);
    try {
      const res = await fetch(`/api/shop-offers/${o.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || "Couldn't delete this offer."); return; }
      if (data.status === "archived") {
        toast.success("Offer has been used, so it was archived instead");
        await fetchOffers({ silent: true });
      } else {
        toast.success(`${o.title} deleted`);
        updateOffers(offers.filter(x => x.id !== o.id));
      }
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  };

  const counts = Object.fromEntries(FILTERS.map(([id, , test]) => [id, offers.filter(test).length]));
  const visible = offers.filter((FILTERS.find(f => f[0] === filter) || FILTERS[0])[2]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Offers & coupons</h3>
          <p className="text-xs text-gray-400">Discounts for your menu page. One offer applies per order — the best one the customer qualifies for.</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => openEditor("new")}>
            <Plus size={13} className="mr-1" /> Create offer
          </Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filter === id
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
            }`}>
            {label} ({counts[id] || 0})
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={() => fetchOffers()} className="ml-auto">Refresh</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-20">
          <Loader2 size={18} className="animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="text-center py-10 border border-red-200 bg-red-50 rounded-xl text-sm">
          <p className="text-red-700 font-medium">{error}</p>
          <button onClick={() => fetchOffers()} className="mt-2 text-xs underline text-gray-500">Try again</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <Tag size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">
            {offers.length === 0 ? "No offers yet" : "No offers here"}
          </p>
          {offers.length === 0 && (
            <p className="text-xs text-gray-300 mt-1">
              {isAdmin ? "Create a discount or coupon code to bring customers back" : "Admins can create discounts and coupon codes"}
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map(o => {
            const [stateLabel, stateCls] = STATE_BADGE[o.state] || [o.state || "—", "bg-gray-50 text-gray-500 border-gray-200"];
            const archived = o.state === "archived" || !!o.archived_at;
            const conditions = conditionsLine(o, { currency, branchNameById, multiBranch, timeZone: defaultTimezone });
            return (
              <div key={o.id} className={`border rounded-xl bg-white p-4 space-y-3 ${archived ? "opacity-70" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5 flex-wrap">
                      {o.title}
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${stateCls}`}>{stateLabel}</span>
                    </p>
                    <p className="text-xs text-gray-500">{o.label || offerLabel(o, currency)}</p>
                  </div>
                  {isAdmin && !archived && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Switch checked={!!o.is_active} disabled={busyId === o.id}
                        onCheckedChange={() => togglePause(o)} aria-label={o.is_active ? "Pause offer" : "Resume offer"} />
                      <span className={`text-[11px] ${o.is_active ? "text-gray-500" : "text-gray-400"}`}>
                        {o.is_active ? "On" : "Paused"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {o.application === "code" ? (
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-gray-900 text-white tracking-wide">{o.code}</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">Automatic</span>
                  )}
                  {o.application === "code" && o.is_visible === false && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-gray-50 text-gray-600 border-gray-200">
                      <EyeOff size={10} /> Hidden
                    </span>
                  )}
                </div>

                {conditions && <p className="text-xs text-gray-400">{conditions}</p>}
                <UsageLine o={o} currency={currency} />

                <div className="flex gap-2 pt-1 flex-wrap">
                  {isAdmin && !archived && (
                    <button onClick={() => openEditor("edit", o)}
                      className="flex items-center justify-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5">
                      <Pencil size={11} /> Edit
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => openEditor("duplicate", o)}
                      className="flex items-center justify-center gap-1 text-xs border rounded-lg px-3 py-1.5 hover:bg-gray-50">
                      <Copy size={11} /> Duplicate
                    </button>
                  )}
                  <button onClick={() => setViewing(o)}
                    className="flex items-center justify-center gap-1 text-xs border rounded-lg px-3 py-1.5 hover:bg-gray-50">
                    <ClipboardList size={11} /> View orders
                  </button>
                  {isAdmin && !archived && (
                    <button onClick={() => remove(o)} disabled={busyId === o.id} aria-label={`Delete ${o.title}`}
                      className="ml-auto text-xs border rounded-lg px-2 py-1.5 hover:bg-red-50 text-red-500 disabled:opacity-50">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isAdmin && (
        <p className="text-xs text-gray-400">Only project admins can create or change offers.</p>
      )}

      {editor && (
        <OfferEditor
          key={editor.key}
          open
          mode={editor.mode}
          offer={editor.offer}
          projectId={projectId}
          branches={branches}
          currency={currency}
          timeZone={defaultTimezone}
          onClose={() => setEditor(null)}
          onSaved={async () => { setEditor(null); await fetchOffers({ silent: true }); }}
        />
      )}

      {viewing && (
        <OfferRedemptionsDrawer offer={viewing} currency={currency} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
