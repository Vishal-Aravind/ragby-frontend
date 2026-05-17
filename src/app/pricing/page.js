"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PRICE_IDS = {
  pro: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY,
    yearly: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY,
  },
  business: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_MONTHLY,
    yearly: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_YEARLY,
  },
};

const PLANS = [
  {
    key: "free",
    name: "Free",
    priceUSD: { monthly: 0, yearly: 0 },
    priceINR: { monthly: 0, yearly: 0 },
    features: [
      { text: "100 conversations / month", included: true },
      { text: "1 project", included: true },
      { text: "Shareable chat link", included: true },
      { text: "Telegram & Slack", included: true },
      { text: "WhatsApp", included: false },
      { text: "Remove Zavo branding", included: false },
    ],
    cta: "Get started",
    featured: false,
  },
  {
    key: "pro",
    name: "Pro",
    priceUSD: { monthly: 20, yearly: 8 },
    priceINR: { monthly: 1899, yearly: 699 },
    features: [
      { text: "1,000 conversations / month", included: true },
      { text: "5 projects", included: true },
      { text: "All channels incl. WhatsApp", included: true },
      { text: "No Zavo branding", included: true },
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
    priceUSD: { monthly: 40, yearly: 16 },
    priceINR: { monthly: 3499, yearly: 1499 },
    features: [
      { text: "7,500 conversations / month", included: true },
      { text: "Unlimited projects", included: true },
      { text: "All channels incl. WhatsApp", included: true },
      { text: "No Zavo branding", included: true },
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
  const [currency, setCurrency] = useState("usd");
  const [loadingPlan, setLoadingPlan] = useState(null);

  const fmt = (plan) => {
    const p = currency === "usd" ? plan.priceUSD : plan.priceINR;
    const val = billing === "yearly" ? p.yearly : p.monthly;
    if (val === 0) return currency === "usd" ? "$0" : "₹0";
    return currency === "usd" ? `$${val}` : `₹${val.toLocaleString("en-IN")}`;
  };

  const fmtOld = (plan) => {
    const p = currency === "usd" ? plan.priceUSD : plan.priceINR;
    if (p.monthly === 0) return null;
    return currency === "usd" ? `$${p.monthly}` : `₹${p.monthly.toLocaleString("en-IN")}`;
  };

  const handleCheckout = async (plan) => {
    if (plan.key === "free") {
      router.push("/login");
      return;
    }

    if (currency === "inr") {
      toast.error("Please switch to USD to checkout. INR payments coming soon.");
      return;
    }

    const priceId = PRICE_IDS[plan.key]?.[billing];
    if (!priceId) {
      toast.error("Price not found. Please try again.");
      return;
    }

    setLoadingPlan(plan.key);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Failed to create checkout session.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="h-14 border-b bg-white px-6 flex items-center justify-between sticky top-0 z-50">
        <button onClick={() => router.push("/dashboard")} className="font-semibold text-sm">zavo</button>
        <button onClick={() => router.push("/dashboard")} className="text-sm text-muted-foreground hover:text-foreground">Back to dashboard</button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold tracking-tight mb-3">Simple, transparent pricing</h1>
          <p className="text-muted-foreground text-sm">Start free. Upgrade when you need more.</p>
        </div>

        <div className="flex items-center justify-center gap-3 flex-wrap mb-10">
          <div className="flex items-center bg-white border rounded-full p-1 gap-1">
            <button onClick={() => setBilling("monthly")} className={`px-4 py-1.5 rounded-full text-sm transition-all ${billing === "monthly" ? "bg-gray-900 text-white" : "text-muted-foreground"}`}>Monthly</button>
            <button onClick={() => setBilling("yearly")} className={`px-4 py-1.5 rounded-full text-sm transition-all ${billing === "yearly" ? "bg-gray-900 text-white" : "text-muted-foreground"}`}>Yearly</button>
          </div>
          {billing === "yearly" && (
            <span className="text-xs bg-green-50 text-green-700 border border-green-100 rounded-full px-3 py-1 font-medium">Save 60%</span>
          )}
          <div className="flex items-center bg-white border rounded-full p-1 gap-1">
            <button onClick={() => setCurrency("usd")} className={`px-4 py-1.5 rounded-full text-sm transition-all ${currency === "usd" ? "bg-gray-900 text-white" : "text-muted-foreground"}`}>$ USD</button>
            <button onClick={() => setCurrency("inr")} className={`px-4 py-1.5 rounded-full text-sm transition-all ${currency === "inr" ? "bg-gray-900 text-white" : "text-muted-foreground"}`}>₹ INR</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`bg-white rounded-2xl p-6 flex flex-col gap-5 ${plan.featured ? "border-2 border-blue-500 shadow-md" : "border border-gray-200"}`}>
              <div>
                {plan.badge && (
                  <span className="inline-block text-xs bg-blue-50 text-blue-600 border border-blue-100 rounded-full px-3 py-0.5 font-medium mb-3">{plan.badge}</span>
                )}
                <p className="text-sm font-medium text-muted-foreground mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-1.5">
                  {billing === "yearly" && plan.priceUSD.monthly > 0 && (
                    <span className="text-sm text-muted-foreground line-through">{fmtOld(plan)}</span>
                  )}
                  <span className="text-3xl font-semibold">{fmt(plan)}</span>
                  <span className="text-sm text-muted-foreground">/ month</span>
                </div>
                {billing === "yearly" && plan.priceUSD.monthly > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Billed annually</p>
                )}
              </div>

              <button
                onClick={() => handleCheckout(plan)}
                disabled={loadingPlan === plan.key}
                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${plan.featured ? "bg-gray-900 text-white hover:bg-gray-700" : "border border-gray-200 hover:bg-gray-50"}`}
              >
                {loadingPlan === plan.key && <Loader2 size={14} className="animate-spin" />}
                {plan.cta}
              </button>

              <div className="border-t" />

              <ul className="flex flex-col gap-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f.text} className={`flex items-center gap-2.5 text-sm ${f.included ? "text-gray-700" : "text-gray-400"}`}>
                    {f.included ? <Check size={14} className="text-emerald-500 shrink-0" /> : <X size={14} className="text-gray-300 shrink-0" />}
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          All plans include a 14-day free trial. No credit card required for Free plan.
        </p>
      </div>
    </div>
  );
}