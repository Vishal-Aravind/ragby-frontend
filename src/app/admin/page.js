"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LayoutDashboard, Building2, CreditCard, Activity, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import OverviewTab from "@/components/admin/OverviewTab";
import TenantsTab from "@/components/admin/TenantsTab";
import BillingTab from "@/components/admin/BillingTab";
import SystemHealthTab from "@/components/admin/SystemHealthTab";
import AuditLogTab from "@/components/admin/AuditLogTab";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "tenants", label: "Tenants", icon: Building2 },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "health", label: "System Health", icon: Activity },
  { key: "audit", label: "Audit Log", icon: ScrollText },
];

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    // requireStaff() in each /api/admin/** route is the real security
    // boundary — this call only decides whether to render the page shell
    // or the access-denied screen, same as the previous admin page's model.
    fetch("/api/admin/me")
      .then(r => r.json())
      .then(d => {
        if (!d.isStaff) setUnauthorized(true);
        setLoading(false);
      })
      .catch(() => { setUnauthorized(true); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );

  if (unauthorized) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-medium">Access denied</p>
        <p className="text-sm text-muted-foreground mt-1">You don't have permission to view this page.</p>
        <button onClick={() => router.push("/dashboard")} className="mt-4 text-sm text-blue-600">
          Back to dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="h-14 border-b bg-white px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="font-semibold text-sm">askzavo</button>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border">Admin</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
          {TABS.map(t => (
            <Button
              key={t.key}
              variant={activeTab === t.key ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(t.key)}
              className="flex items-center gap-1.5"
            >
              <t.icon size={14} />
              {t.label}
            </Button>
          ))}
        </div>

        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "tenants" && <TenantsTab />}
        {activeTab === "billing" && <BillingTab />}
        {activeTab === "health" && <SystemHealthTab />}
        {activeTab === "audit" && <AuditLogTab />}
      </main>
    </div>
  );
}
