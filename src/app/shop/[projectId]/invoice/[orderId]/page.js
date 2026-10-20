"use client";

// Public invoice page. Auth is the per-order receipt (?r=, from the WhatsApp
// link / payment return) or this tab's customer token; both go to the
// backend in a POST body. Every failure is the same "not found".

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import InvoiceView from "@/components/shop/InvoiceView";
import { UUID_RE, getInvoice, errorCode } from "../../_lib/shopApi";
import { readToken } from "../../_lib/identity";

export default function PublicInvoicePage() {
  return (
    <Suspense fallback={null}>
      <PublicInvoice />
    </Suspense>
  );
}

function PublicInvoice() {
  const { projectId, orderId } = useParams();
  const searchParams = useSearchParams();
  const receipt = searchParams.get("r");
  const [state, setState] = useState({ phase: "loading", invoice: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!UUID_RE.test(projectId || "") || !UUID_RE.test(orderId || "")) {
        setState({ phase: "missing", invoice: null });
        return;
      }
      const token = readToken(projectId);
      const auth = receipt ? { receipt } : token ? { customer_token: token } : null;
      if (!auth) {
        setState({ phase: "missing", invoice: null });
        return;
      }
      const r = await getInvoice(projectId, orderId, auth);
      if (!alive) return;
      if (r.ok && r.data) setState({ phase: "ready", invoice: r.data });
      else if (errorCode(r.data) === "invoice_not_ready") setState({ phase: "not_ready", invoice: null });
      else if (r.status === 0 || r.status >= 500) setState({ phase: "error", invoice: null });
      else setState({ phase: "missing", invoice: null });
    })();
    return () => {
      alive = false;
    };
  }, [projectId, orderId, receipt]);

  if (state.phase === "ready") {
    return (
      <div className="min-h-screen bg-gray-50">
        <InvoiceView invoice={state.invoice} />
      </div>
    );
  }

  const text = {
    loading: "Loading invoice…",
    not_ready: "The invoice isn't ready yet. It's created once the order is paid or confirmed.",
    error: "Couldn't load the invoice. Please try again.",
    missing: "Invoice not found. Open it from your WhatsApp order message.",
  }[state.phase];
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <p className="text-sm text-gray-600 text-center max-w-sm">{text}</p>
    </div>
  );
}
