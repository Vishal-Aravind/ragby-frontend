"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Copy, Trash2, Loader2, MapPin, Phone, AlertTriangle, Store, Clock } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/confirmDialog";
import BranchEditor from "./BranchEditor";
import { StatusDot, branchTone } from "./BranchSelector";

export const WARNING_TEXT = {
  no_location: "No map location set. Customers won't see how far this branch is, and distance-based delivery won't work.",
  delivery_not_configured: "Delivery is on but no delivery area is set — customers can only pick up.",
  no_phone: "No phone number. New-order alerts go to the store phone in Settings.",
  no_menu: "No menu yet. Add catalogs in Menu, or copy the menu from another branch.",
};

const TONE_TEXT = {
  open: "text-green-700",
  paused: "text-amber-700",
  closed: "text-gray-500",
  off: "text-gray-400",
};

function Chip({ children, tone = "gray" }) {
  const cls = {
    gray: "bg-gray-50 text-gray-600 border-gray-200",
    green: "bg-green-50 text-green-700 border-green-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
  }[tone];
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{children}</span>;
}

function deliveryChip(b) {
  if (!b.delivery_enabled) return null;
  const parts = [];
  if (b.max_delivery_km) parts.push(`${Number(b.max_delivery_km)} km`);
  const pins = (b.pincodes || []).length;
  if (pins) parts.push(`${pins} pincode${pins === 1 ? "" : "s"}`);
  return `Delivery${parts.length ? " · " + parts.join(" / ") : ""}`;
}

export default function BranchesPanel({
  projectId, branches, loading, error, isAdmin, currency, defaultTimezone,
  onRefresh, onCopyMenu,
}) {
  const [editing, setEditing] = useState(null); // null | "new" | branch
  const [busyId, setBusyId] = useState(null);

  const togglePause = async (b) => {
    setBusyId(b.id);
    try {
      const res = await fetch(`/api/shop-branches/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepting_orders: !b.accepting_orders }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || "Couldn't update this branch."); return; }
      toast.success(b.accepting_orders ? `${b.name} paused — not taking orders` : `${b.name} is taking orders again`);
      await onRefresh();
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (b) => {
    const ok = await confirmDialog({
      title: `Delete ${b.name}?`,
      description: `Its menu (${b.catalog_count || 0} catalog${b.catalog_count === 1 ? "" : "s"} and all their items) is deleted too. This cannot be undone.\n\nTo stop orders for a while instead, turn off "Taking orders".`,
      confirmText: "Delete branch",
      cancelText: "Keep it",
    });
    if (!ok) return;
    setBusyId(b.id);
    try {
      const res = await fetch(`/api/shop-branches/${b.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "branch_has_orders") {
          toast.error(data.error || "This branch has orders. Turn it off instead.", {
            description: "Edit the branch and switch off \"Branch is active\" to hide it from customers.",
          });
        } else {
          toast.error(data.error || "Couldn't delete this branch.");
        }
        return;
      }
      toast.success(`${b.name} deleted`);
      await onRefresh();
    } catch {
      toast.error("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  };

  if (editing) {
    return (
      <BranchEditor
        branch={editing === "new" ? null : editing}
        projectId={projectId}
        currency={currency}
        defaultTimezone={defaultTimezone}
        onClose={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await onRefresh(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">Branches</h3>
          <p className="text-xs text-gray-400">Each branch has its own menu, opening hours, and pickup / delivery settings</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus size={13} className="mr-1" /> Add branch
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-20">
          <Loader2 size={18} className="animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="text-center py-10 border border-red-200 bg-red-50 rounded-xl text-sm">
          <p className="text-red-700 font-medium">{error}</p>
          <button onClick={onRefresh} className="mt-2 text-xs underline text-gray-500">Try again</button>
        </div>
      ) : branches.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
          <Store size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No branches yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {branches.map(b => {
            const tone = branchTone(b);
            const delivery = deliveryChip(b);
            const warnings = (b.warnings || []).filter(w => WARNING_TEXT[w]);
            return (
              <div key={b.id} className={`border rounded-xl bg-white p-4 space-y-3 ${b.is_active === false ? "opacity-75" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  {b.image_url && (
                    <img src={b.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5 flex-wrap">
                      {b.name}
                      {b.is_default && <Chip tone="blue">Default</Chip>}
                      {b.is_active === false && <Chip>Turned off</Chip>}
                    </p>
                    <p className={`text-xs mt-1 flex items-center gap-1.5 ${TONE_TEXT[tone]}`}>
                      <StatusDot branch={b} />
                      {b.is_active === false ? "Hidden from customers" : (b.status?.label || "")}
                    </p>
                    {b.status?.today_hours_label && b.is_active !== false && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                        <Clock size={11} /> {b.status.today_hours_label}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Switch checked={b.accepting_orders !== false} disabled={busyId === b.id}
                      onCheckedChange={() => togglePause(b)} aria-label="Taking orders" />
                    <span className={`text-[11px] ${b.accepting_orders !== false ? "text-gray-500" : "text-amber-700 font-medium"}`}>
                      {b.accepting_orders !== false ? "Taking orders" : "Paused"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-gray-500">
                  {b.address && <p className="flex items-start gap-1.5"><MapPin size={11} className="mt-0.5 shrink-0" /> <span className="line-clamp-2">{b.address}</span></p>}
                  {b.phone && <p className="flex items-center gap-1.5"><Phone size={11} /> +{String(b.phone).replace(/^\+/, "")}</p>}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {b.pickup_enabled && <Chip tone="green">Pickup</Chip>}
                  {delivery && <Chip tone="green">{delivery}</Chip>}
                  {!b.pickup_enabled && !b.delivery_enabled && <Chip>No pickup or delivery</Chip>}
                  <Chip>{b.catalog_count || 0} catalog{b.catalog_count === 1 ? "" : "s"}</Chip>
                  {Number(b.min_order_value) > 0 && <Chip>Min {currency}{Number(b.min_order_value)}</Chip>}
                  {b.prep_minutes ? <Chip>~{b.prep_minutes} min</Chip> : null}
                </div>

                {warnings.length > 0 && (
                  <div className="space-y-1">
                    {warnings.map(w => (
                      <p key={w} className={`flex items-start gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border ${
                        w === "delivery_not_configured" ? "text-red-700 bg-red-50 border-red-100" : "text-amber-700 bg-amber-50 border-amber-100"
                      }`}>
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {WARNING_TEXT[w]}
                      </p>
                    ))}
                  </div>
                )}

                {isAdmin && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditing(b)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5">
                      <Pencil size={11} /> Edit
                    </button>
                    {branches.length > 1 && (
                      <button onClick={() => onCopyMenu(b)}
                        className="flex-1 flex items-center justify-center gap-1 text-xs border rounded-lg px-3 py-1.5 hover:bg-gray-50">
                        <Copy size={11} /> Copy menu…
                      </button>
                    )}
                    {!b.is_default && (
                      <button onClick={() => remove(b)} disabled={busyId === b.id} aria-label={`Delete ${b.name}`}
                        className="text-xs border rounded-lg px-2 py-1.5 hover:bg-red-50 text-red-500 disabled:opacity-50">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isAdmin && (
        <p className="text-xs text-gray-400">Only project admins can add or edit branches. You can pause or resume orders.</p>
      )}
    </div>
  );
}
