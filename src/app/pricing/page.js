"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PLANS = [
  {
    key: "free",
    name: "Free",
    monthlyUSD: 0,
    yearlyUSD: 0,
    monthlyINR: 0,
    yearlyINR: 0,
    features: [
      { text: "300 messages / month", included: true },
      { text: "Website widget", included: true },
      { text: "Shareable chat link", included: true },
      { text: "Telegram & Slack", included: true },
      { text: "WhatsApp", included: false },
      { text: "Remove Askzavo branding", included: false },
    ],
    cta: "Get started free",
    featured: false,
  },
  {
    key: "pro",
    name: "Pro",
    monthlyUSD: 14,
    yearlyUSD: 9,
    monthlyINR: 1299,
    yearlyINR: 899,
    features: [
      { text: "5,000 messages / month", included: true },
      { text: "All channels incl. WhatsApp", included: true },
      { text: "No Askzavo branding", included: true },
      { text: "Lead capture widget", included: true },
      { text: "Email support", included: true },
    ],
    cta: "Get started",
    featured: true,
    badge: "Most popular",
  },
  {
    key: "business",
    name: "Business",
    monthlyUSD: 27,
    yearlyUSD: 20,
    monthlyINR: 2599,
    yearlyINR: 1899,
    features: [
      { text: "25,000 messages / month", included: true },
      { text: "All channels incl. WhatsApp", included: true },
      { text: "No Askzavo branding", included: true },
      { text: "Priority support", included: true },
      { text: "Custom integrations", included: true },
    ],
    cta: "Get started",
    featured: false,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [billing, setBilling] = useState("monthly");
  const [loadingPlan, setLoadingPlan] = useState(null);

  const getPrice = (plan) => {
    if (plan.key === "free") return "Free";
    // show INR as reference, USD is the display price — Razorpay charges
    // whatever currency/amount is set on the underlying Plan object.
    return billing === "yearly"
      ? `$${plan.yearlyUSD}`
      : `$${plan.monthlyUSD}`;
  };

  const getINRPrice = (plan) => {
    if (plan.key === "free") return "₹0";
    return billing === "yearly"
      ? `~₹${plan.yearlyINR.toLocaleString("en-IN")}/mo`
      : `~₹${plan.monthlyINR.toLocaleString("en-IN")}/mo`;
  };

  const getOldPrice = (plan) => {
    if (plan.key === "free" || billing === "monthly") return null;
    return `$${plan.monthlyUSD}`;
  };

  const handleCheckout = async (plan) => {
    if (plan.key === "free") {
      router.push("/login");
      return;
    }

    setLoadingPlan(plan.key);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.key, billing }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.detail || "Failed to start checkout.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="h-14 border-b bg-white px-6 flex items-center justify-between sticky top-0 z-50">
        <button onClick={() => router.push("/dashboard")} className="font-semibold text-sm">
          askzavo
        </button>
        <button onClick={() => router.push("/dashboard")} className="text-sm text-muted-foreground hover:text-foreground">
          Back to dashboard
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold tracking-tight mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-muted-foreground text-sm">
            Start free. Upgrade when your business grows.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="flex items-center bg-white border rounded-full p-1 gap-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                billing === "monthly" ? "bg-gray-900 text-white" : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                billing === "yearly" ? "bg-gray-900 text-white" : "text-muted-foreground"
              }`}
            >
              Yearly
            </button>
          </div>
          {billing === "yearly" && (
            <span className="text-xs bg-green-50 text-green-700 border border-green-100 rounded-full px-3 py-1 font-medium">
              Save 35%
            </span>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`bg-white rounded-2xl p-6 flex flex-col gap-5 ${
                plan.featured
                  ? "border-2 border-blue-500 shadow-md"
                  : "border border-gray-200"
              }`}
            >
              <div>
                {plan.badge && (
                  <span className="inline-block text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-3 py-0.5 font-medium mb-3">
                    {plan.badge}
                  </span>
                )}
                <p className="text-sm font-medium text-muted-foreground mb-1">{plan.name}</p>

                <div className="flex items-baseline gap-1.5">
                  {getOldPrice(plan) && (
                    <span className="text-sm text-muted-foreground line-through">
                      {getOldPrice(plan)}
                    </span>
                  )}
                  <span className="text-3xl font-semibold">{getPrice(plan)}</span>
                  {plan.key !== "free" && (
                    <span className="text-sm text-muted-foreground">/ month</span>
                  )}
                </div>

                {plan.key !== "free" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {getINRPrice(plan)} · {billing === "yearly" ? "billed annually" : "billed monthly"}
                  </p>
                )}

                {billing === "yearly" && plan.key !== "free" && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ${plan.yearlyUSD * 12}/year total
                  </p>
                )}
              </div>

              <button
                onClick={() => handleCheckout(plan)}
                disabled={loadingPlan === plan.key}
                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                  plan.featured
                    ? "bg-gray-900 text-white hover:bg-gray-700"
                    : "border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {loadingPlan === plan.key && <Loader2 size={14} className="animate-spin" />}
                {plan.cta}
              </button>

              <div className="border-t" />

              <ul className="flex flex-col gap-2.5 flex-1">
                {plan.features.map((f) => (
                  <li
                    key={f.text}
                    className={`flex items-center gap-2.5 text-sm ${
                      f.included ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    {f.included
                      ? <Check size={14} className="text-emerald-500 shrink-0" />
                      : <X size={14} className="text-gray-300 shrink-0" />
                    }
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer notes */}
        <div className="text-center mt-10 space-y-2">
          <p className="text-xs text-muted-foreground">
            Prices shown in USD. Indian users will be charged in INR at current exchange rates.
          </p>
          <p className="text-xs text-muted-foreground">
            WhatsApp Business API usage fees are charged separately by Meta.
          </p>
          <p className="text-xs text-muted-foreground">
            No credit card required for Free plan.
          </p>
        </div>
      </div>
    </div>
  );
}