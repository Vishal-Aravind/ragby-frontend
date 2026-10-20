"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import InvoiceView from "@/components/shop/InvoiceView";

export default function DashboardInvoice({ projectId, orderId }) {
  const [state, setState] = useState({ phase: "loading", invoice: null, error: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/invoice`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (res.ok) setState({ phase: "ready", invoice: data, error: null });
        else setState({ phase: "error", invoice: null, error: data?.error || "Couldn't load the invoice." });
      } catch {
        if (alive) setState({ phase: "error", invoice: null, error: "Couldn't load the invoice." });
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId]);

  return (
    <div className="min-h-full">
      <div className="zv-no-print max-w-3xl mx-auto px-4 pt-4">
        <Link
          href={`/dashboard/${projectId}/shop`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={14} /> Back to shop
        </Link>
      </div>
      {state.phase === "ready" ? (
        <InvoiceView invoice={state.invoice} />
      ) : (
        <p className="text-sm text-gray-600 text-center px-4 py-16">
          {state.phase === "loading" ? "Loading invoice…" : state.error}
        </p>
      )}
    </div>
  );
}
