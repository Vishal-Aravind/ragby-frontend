"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2, ArrowLeft, Ban, CheckCircle2, Eye, MessageCircle,
  ShoppingBag, Calendar, Users2, Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const INTEGRATIONS = [
  { key: "whatsapp", label: "WhatsApp", detail: d => d.waba_id ? `WABA ${d.waba_id}` : null },
  { key: "telegram", label: "Telegram", detail: d => d.bot_username ? `@${d.bot_username}` : null },
  { key: "slack", label: "Slack", detail: d => d.team_name || null },
  { key: "shopify", label: "Shopify", detail: d => d.shop_domain || null },
  { key: "razorpay", label: "Razorpay", detail: d => d.razorpay_account_id || null },
];

function formatMinutesLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  return `${Math.ceil(ms / 60000)}m`;
}

export default function TenantDetailPage() {
  const { projectId } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewAs, setViewAs] = useState(null);
  const [reason, setReason] = useState("");
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/tenants/${projectId}`);
    if (res.status === 403) { setForbidden(true); setLoading(false); return; }
    if (!res.ok) { setLoading(false); return; }
    setData(await res.json());
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!viewAs) return;
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, [viewAs]);

  const runAction = async (path, body, successMsg) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tenants/${projectId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Action failed");
        return null;
      }
      toast.success(successMsg);
      return await res.json();
    } finally {
      setBusy(false);
    }
  };

  const handlePlanOverride = async (plan) => {
    if (!confirm(`Set this tenant's plan to "${plan}"? This does not touch their Razorpay subscription — the next real billing event will overwrite it.`)) return;
    const result = await runAction("plan-override", { plan }, `Plan set to ${plan}`);
    if (result) load();
  };

  const handleSuspend = async () => {
    if (!confirm("Suspend this tenant? Their bot will stop responding on every channel until reactivated.")) return;
    const result = await runAction("suspend", null, "Tenant suspended");
    if (result) load();
  };

  const handleReactivate = async () => {
    const result = await runAction("reactivate", null, "Tenant reactivated");
    if (result) load();
  };

  const handleViewAs = async () => {
    const result = await runAction("view-as", { reason }, "View-as session started");
    if (result) { setViewAs(result); setReason(""); }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );

  if (forbidden) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">You don't have permission to view this page.</p>
    </div>
  );

  if (!data) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Tenant not found.</p>
    </div>
  );

  const { project, owner, members, usage, integrations, activityLast7Days } = data;
  const usagePct = usage.limit ? Math.min(100, (usage.count / usage.limit) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="h-14 border-b bg-white px-6 flex items-center gap-3 sticky top-0 z-50">
        <button onClick={() => router.push("/admin")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft size={14} /> Admin
        </button>
      </header>

      {viewAs && (
        <div className="bg-purple-600 text-white text-sm px-6 py-2 flex items-center justify-between">
          <span className="flex items-center gap-2"><Eye size={14} /> Viewing as {owner?.email} — read-only, expires in {formatMinutesLeft(viewAs.expiresAt)}</span>
          <button onClick={() => setViewAs(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{project.name || "Untitled tenant"}</h1>
            <p className="text-sm text-muted-foreground">{owner?.email} · created {new Date(project.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2">
            {project.suspended ? (
              <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                <Ban size={11} /> Suspended
              </span>
            ) : (
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">Active</span>
            )}
          </div>
        </div>

        {/* Usage */}
        <div className="bg-white border rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3">Usage this month</h3>
          <div className="flex justify-between text-xs mb-1">
            <span>{usage.count.toLocaleString()}</span>
            <span className="text-muted-foreground">{usage.limit ? usage.limit.toLocaleString() : "unlimited"}</span>
          </div>
          {usage.limit && (
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${usagePct >= 100 ? "bg-red-500" : usagePct >= 80 ? "bg-amber-400" : "bg-blue-500"}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2 capitalize">Plan: {owner?.plan || "free"}</p>
        </div>

        {/* Recent activity */}
        <div className="bg-white border rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3">Activity — last 7 days</h3>
          <div className="grid grid-cols-5 gap-3 text-center">
            {[
              { icon: MessageCircle, label: "Chats", value: activityLast7Days.chats },
              { icon: ShoppingBag, label: "Orders", value: activityLast7Days.orders },
              { icon: Calendar, label: "Appointments", value: activityLast7Days.appointments },
              { icon: Users2, label: "Leads", value: activityLast7Days.leads },
              { icon: Ticket, label: "Event signups", value: activityLast7Days.events },
            ].map(m => (
              <div key={m.label}>
                <m.icon size={16} className="mx-auto text-gray-400 mb-1" />
                <p className="text-lg font-semibold text-gray-900">{m.value}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b"><h3 className="text-sm font-semibold">Integrations</h3></div>
          <div className="divide-y">
            {INTEGRATIONS.map(i => {
              const d = integrations[i.key];
              return (
                <div key={i.key} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <span className="text-gray-800">{i.label}</span>
                  {d.connected ? (
                    <span className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={12} /> {i.detail(d) || "Connected"}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not connected</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Team */}
        <div className="bg-white border rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-2">Team ({1 + members.length})</h3>
          <p className="text-xs text-muted-foreground">{members.length} additional member{members.length === 1 ? "" : "s"} beyond the owner.</p>
        </div>

        {/* Actions */}
        <div className="bg-white border rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-semibold">Staff actions</h3>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground w-full sm:w-auto">Plan override:</span>
            {["free", "pro", "business"].map(p => (
              <Button key={p} size="sm" variant="outline" disabled={busy || owner?.plan === p} onClick={() => handlePlanOverride(p)}>
                {p}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {project.suspended ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={handleReactivate}>
                <CheckCircle2 size={14} className="mr-1.5" /> Reactivate
              </Button>
            ) : (
              <Button size="sm" variant="destructive" disabled={busy} onClick={handleSuspend}>
                <Ban size={14} className="mr-1.5" /> Suspend
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason (optional, shown in audit log)"
              className="border rounded-lg px-3 py-1.5 text-sm flex-1 max-w-sm outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <Button size="sm" variant="outline" disabled={busy} onClick={handleViewAs}>
              <Eye size={14} className="mr-1.5" /> Start view-as (30m, read-only)
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
