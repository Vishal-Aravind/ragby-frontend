"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, MinusCircle, ExternalLink, AlertTriangle } from "lucide-react";

const JOB_LABELS = {
  appointment_reminders: "Appointment reminders (hourly)",
  scheduled_campaigns: "Scheduled campaigns (every 30s)",
  shopify_reconciliation: "Shopify reconciliation (every 6h)",
  appointment_hold_release: "Appointment hold release (every 2m)",
  whatsapp_sync_monitor: "WhatsApp Coexistence sync monitor (every 30m)",
};

function timeAgo(ts) {
  if (!ts) return "never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function SystemHealthTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/system-health")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>;
  if (!data) return <div className="text-sm text-muted-foreground py-8 text-center">Failed to load.</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Scheduled jobs</h3>
        </div>
        <div className="divide-y">
          {data.jobs.map(j => {
            const status = j.lastRun?.status;
            return (
              <div key={j.name} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {status === "success" ? (
                    <CheckCircle2 size={15} className="text-emerald-500" />
                  ) : status === "failure" ? (
                    <XCircle size={15} className="text-red-500" />
                  ) : (
                    <MinusCircle size={15} className="text-gray-300" />
                  )}
                  <span className="text-sm text-gray-800">{JOB_LABELS[j.name] || j.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {j.lastRun ? `Last run ${timeAgo(j.lastRun.finished_at)} · ${status}` : "No recorded runs yet"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border rounded-2xl px-4 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Error tracking</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Unhandled + explicitly-captured exceptions across the backend.</p>
        </div>
        {data.sentryProjectUrl ? (
          <a href={data.sentryProjectUrl} target="_blank" rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
            Open Sentry <ExternalLink size={13} />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Set NEXT_PUBLIC_SENTRY_PROJECT_URL to link directly here</span>
        )}
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          <h3 className="text-sm font-semibold">Tenants near their monthly quota (≥80%)</h3>
        </div>
        <div className="divide-y">
          {data.nearLimitTenants.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">None right now.</div>
          ) : (
            data.nearLimitTenants.map(t => (
              <div key={t.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="text-gray-800">{t.email}</span>
                <span className={`text-xs font-medium ${t.pct >= 1 ? "text-red-600" : "text-amber-600"}`}>
                  {t.usage.toLocaleString()} / {t.limit.toLocaleString()} ({Math.round(t.pct * 100)}%)
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
