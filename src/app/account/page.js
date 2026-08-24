"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Zap, CreditCard, CheckCircle2, XCircle, X } from "lucide-react";
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
    "Website widget & shareable link",
    "Telegram & Slack",
  ],
  pro: [
    "5,000 messages / month",
    "All channels incl. WhatsApp",
    "No Askzavo branding",
    "Lead capture widget",
    "Email support",
  ],
  business: [
    "25,000 messages / month",
    "All channels incl. WhatsApp",
    "No Askzavo branding",
    "Priority support",
    "Custom integrations",
  ],
};

// Razorpay's hosted subscription page has no configurable redirect-back —
// unlike Stripe Checkout's success_url, there's no way to land the
// customer back on our own site automatically after they pay. Opening it
// in a new tab (same pattern already used for Shop/Appointment payment
// links) and polling here for the plan to flip is the closest equivalent
// to Stripe's "?upgraded=true" landing this API actually supports.
function usePlanPolling(active, onUpdate) {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/billing/plan");
        if (!res.ok || cancelled) return;
        onUpdate(await res.json());
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 4000);
    window.addEventListener("focus", poll);
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener("focus", poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [usage, setUsage] = useState(null);
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);

  const [awaitingCheckout, setAwaitingCheckout] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [changeTarget, setChangeTarget] = useState({ plan: "pro", billing: "monthly" });
  const [changingPlan, setChangingPlan] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelAtCycleEnd, setCancelAtCycleEnd] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const loadPlan = async () => {
    const res = await fetch("/api/billing/plan");
    if (res.ok) setPlanData(await res.json());
  };

  const loadInvoices = async () => {
    try {
      const res = await fetch("/api/billing/invoices");
      if (res.ok) setInvoices((await res.json()).invoices || []);
    } catch {}
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [userRes, usageRes, planRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/usage"),
          fetch("/api/billing/plan"),
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
    loadInvoices();
  }, []);

  usePlanPolling(awaitingCheckout, (data) => {
    setPlanData(data);
    if (data.has_subscription) {
      setAwaitingCheckout(false);
      toast.success("Payment received — plan updated!");
      loadInvoices();
    }
  });

  const handleSubscribe = async (planKey, billingCycle) => {
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey, billing: billingCycle }),
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
        setAwaitingCheckout(true);
      } else {
        toast.error(data.detail || "Could not start checkout.");
      }
    } catch {
      toast.error("Something went wrong.");
    }
  };

  const handleChangePlan = async () => {
    setChangingPlan(true);
    try {
      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changeTarget),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Plan change submitted — this can take a few seconds to reflect.");
        setShowChangePlan(false);
        setTimeout(loadPlan, 3000);
      } else {
        toast.error(data.detail || "Could not change plan.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setChangingPlan(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ at_cycle_end: cancelAtCycleEnd }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(cancelAtCycleEnd ? "Your subscription will end at the current billing period." : "Subscription cancelled.");
        setShowCancelConfirm(false);
        setTimeout(loadPlan, 3000);
      } else {
        toast.error(data.detail || "Could not cancel subscription.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setCancelling(false);
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
  // NOT derived from planData.status — confirmed live that Razorpay keeps
  // status "active" the whole time for a cancel-at-cycle-end subscription,
  // right up until it actually ends. cancel_scheduled is tracked on Zavo's
  // own side instead (see backend/billing.py), which is the only reliable
  // signal here.
  const isCancelled = planData?.cancel_scheduled;
  const cancelsOnDate = planData?.current_end
    ? new Date(planData.current_end * 1000).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })
    : null;

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

          {awaitingCheckout && (
            <div className="flex items-center gap-2 text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-lg px-3 py-2">
              <Loader2 size={13} className="animate-spin" />
              Waiting for payment to complete in the other tab...
            </div>
          )}

          {isCancelled && (
            <div className="flex items-center gap-2 text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded-lg px-3 py-2">
              <XCircle size={13} />
              {cancelsOnDate
                ? <>Cancelled — you'll keep {PLAN_LABELS[plan]} access until <strong>{cancelsOnDate}</strong>, then it drops to Free.</>
                : <>Cancelled — this subscription will not renew.</>}
            </div>
          )}

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
          <div className="border-t pt-4 flex flex-wrap gap-3">
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
                  onClick={() => { setChangeTarget({ plan: plan === "pro" ? "business" : "pro", billing: "monthly" }); setShowChangePlan(true); }}
                  className="flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <CreditCard size={14} />
                  Change plan
                </button>
                {!isCancelled && (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
                  >
                    <XCircle size={14} />
                    Cancel subscription
                  </button>
                )}
              </>
            )}
          </div>

          {/* Change plan inline form */}
          {showChangePlan && (
            <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Change plan</p>
                <button onClick={() => setShowChangePlan(false)}><X size={14} className="text-gray-400" /></button>
              </div>
              <div className="flex gap-2">
                {["pro", "business"].map((p) => (
                  <button key={p}
                    onClick={() => setChangeTarget((t) => ({ ...t, plan: p }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border ${changeTarget.plan === p ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200"}`}>
                    {PLAN_LABELS[p]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {["monthly", "yearly"].map((b) => (
                  <button key={b}
                    onClick={() => setChangeTarget((t) => ({ ...t, billing: b }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border ${changeTarget.billing === b ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200"}`}>
                    {b === "monthly" ? "Monthly" : "Yearly"}
                  </button>
                ))}
              </div>
              <button onClick={handleChangePlan} disabled={changingPlan}
                className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                {changingPlan && <Loader2 size={13} className="animate-spin" />}
                Confirm change
              </button>
              <p className="text-xs text-muted-foreground">Takes effect immediately; any difference is charged or refunded automatically.</p>
            </div>
          )}

          {/* Cancel confirmation */}
          {showCancelConfirm && (
            <div className="border border-red-200 rounded-xl p-4 bg-red-50 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-red-800">Cancel subscription?</p>
                <button onClick={() => setShowCancelConfirm(false)}><X size={14} className="text-red-400" /></button>
              </div>
              <label className="flex items-center gap-2 text-xs text-red-700">
                <input type="radio" checked={cancelAtCycleEnd} onChange={() => setCancelAtCycleEnd(true)} />
                Cancel at the end of the current billing period (recommended)
              </label>
              <label className="flex items-center gap-2 text-xs text-red-700">
                <input type="radio" checked={!cancelAtCycleEnd} onChange={() => setCancelAtCycleEnd(false)} />
                Cancel immediately
              </label>
              <button onClick={handleCancel} disabled={cancelling}
                className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2">
                {cancelling && <Loader2 size={13} className="animate-spin" />}
                Confirm cancellation
              </button>
            </div>
          )}
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

        {/* Invoices */}
        {hasSubscription && invoices.length > 0 && (
          <div className="bg-white border rounded-2xl p-6 space-y-3">
            <h2 className="text-sm font-medium text-gray-900">Billing history</h2>
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                  <span className="text-muted-foreground">
                    {inv.created_at ? new Date(inv.created_at * 1000).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </span>
                  <span className="text-gray-700">
                    {inv.currency || "INR"} {((inv.amount_paid ?? inv.amount ?? 0) / 100).toFixed(2)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Billing note */}
        {hasSubscription && (
          <p className="text-xs text-center text-muted-foreground">
            WhatsApp API usage fees are charged separately by Meta.
          </p>
        )}
      </main>
    </div>
  );
}
