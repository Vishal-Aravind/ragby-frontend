"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap, CreditCard, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";

const PLAN_LIMITS = { free: 300, pro: 5000, business: 25000 };
const PLAN_LABELS = { free: "Free", pro: "Pro", business: "Business" };
const PLAN_PRICES = {
  free: { monthly: "$0", yearly: "$0" },
  pro: { monthly: "$14/mo", yearly: "$9/mo" },
  business: { monthly: "$27/mo", yearly: "$20/mo" },
};
const PLAN_COLORS = {
  free: "bg-gray-100 text-gray-600 border-gray-200",
  pro: "bg-blue-50 text-blue-700 border-blue-100",
  business: "bg-emerald-50 text-emerald-700 border-emerald-100",
};

const PLAN_FEATURES = {
  free: [
    "300 messages / month",
    "1 project",
    "Website widget & shareable link",
    "Telegram & Slack",
  ],
  pro: [
    "5,000 messages / month",
    "3 projects",
    "All channels incl. WhatsApp",
    "No Askzavo branding",
    "Lead capture widget",
    "Email support",
  ],
  business: [
    "25,000 messages / month",
    "Unlimited projects",
    "All channels incl. WhatsApp",
    "No Askzavo branding",
    "Priority support",
    "Custom integrations",
  ],
};

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [usage, setUsage] = useState(null);
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, usageRes, planRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/usage"),
          fetch("/api/stripe/plan"),
        ]);

        if (userRes.ok) {
          const { user } = await userRes.json();
          setUser(user);
        }
        if (usageRes.ok) setUsage(await usageRes.json());
        if (planRes.ok) setPlanData(await planRes.json());
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast.error("Could not open billing portal.");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );

  const plan = usage?.plan || "free";
  const used = usage?.usage || 0;
  const limit = usage?.limit || PLAN_LIMITS[plan] || 300;
  const remaining = usage?.remaining || 0;
  const percent = Math.min((used / limit) * 100, 100);
  const isNearLimit = percent >= 80;
  const isAtLimit = percent >= 100;
  const hasSubscription = planData?.has_subscription || false;

  const barColor = isAtLimit ? "bg-red-500" : isNearLimit ? "bg-amber-400" : "bg-blue-500";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Account & Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your plan and usage</p>
        </div>

        {/* Profile */}
        <div className="bg-white border rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-medium text-gray-900">Profile</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-medium">
              {user?.email?.[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Member since {new Date(user?.created_at || Date.now()).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
            </div>
          </div>
        </div>

        {/* Current plan */}
        <div className="bg-white border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900">Current plan</h2>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${PLAN_COLORS[plan]}`}>
              {PLAN_LABELS[plan]}
            </span>
          </div>

          {/* Usage bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-gray-600 font-medium">Messages this month</span>
              <span className={isAtLimit ? "text-red-500 font-medium" : "text-gray-500"}>
                {used.toLocaleString()} / {limit.toLocaleString()}
              </span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs mt-1.5">
              {isAtLimit ? (
                <span className="text-red-500">Limit reached — upgrade to continue</span>
              ) : isNearLimit ? (
                <span className="text-amber-600">⚠️ {remaining.toLocaleString()} messages remaining</span>
              ) : (
                <span className="text-muted-foreground">{remaining.toLocaleString()} messages remaining</span>
              )}
              <span className="text-muted-foreground">Resets monthly</span>
            </div>
          </div>

          {/* Plan features */}
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">YOUR PLAN INCLUDES</p>
            <ul className="space-y-2">
              {PLAN_FEATURES[plan]?.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="border-t pt-4 flex gap-3">
            {plan === "free" ? (
              <button
                onClick={() => router.push("/pricing")}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                <Zap size={14} />
                Upgrade plan
              </button>
            ) : (
              <>
                <button
                  onClick={openPortal}
                  disabled={portalLoading}
                  className="flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  {portalLoading
                    ? <Loader2 size={14} className="animate-spin" />
                    : <CreditCard size={14} />
                  }
                  Manage subscription
                </button>
                <button
                  onClick={() => router.push("/pricing")}
                  className="flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <Zap size={14} />
                  View all plans
                </button>
              </>
            )}
          </div>
        </div>

        {/* All plans comparison */}
        <div className="bg-white border rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-gray-900">All plans</h2>
          <div className="space-y-3">
            {["free", "pro", "business"].map((p) => (
              <div
                key={p}
                className={`rounded-xl border px-4 py-3 flex items-center justify-between ${
                  p === plan ? "border-blue-200 bg-blue-50/50" : "border-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{PLAN_LABELS[p]}</p>
                      {p === plan && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Current</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {PLAN_LIMITS[p].toLocaleString()} messages/month
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{PLAN_PRICES[p].monthly}</p>
                  <p className="text-xs text-muted-foreground">{PLAN_PRICES[p].yearly} yearly</p>
                </div>
              </div>
            ))}
          </div>
          {plan === "free" && (
            <button
              onClick={() => router.push("/pricing")}
              className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Upgrade now
            </button>
          )}
        </div>

        {/* Billing note */}
        {hasSubscription && (
          <p className="text-xs text-center text-muted-foreground">
            To cancel or update your subscription, click{" "}
            <button onClick={openPortal} className="underline">Manage subscription</button>.
            WhatsApp API usage fees are charged separately by Meta.
          </p>
        )}
      </main>
    </div>
  );
}