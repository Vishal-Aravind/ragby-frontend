"use client";

// Shared Razorpay Partner OAuth connect/disconnect UI, used by both
// ShopTab.js (Payment card) and IntegrationsTab.js (Integrations list) —
// extracted rather than duplicated so the popup+postMessage OAuth logic
// only exists in one place. onStatusChange lets a parent (e.g.
// IntegrationsTab's collapsible header badge) mirror the connected state
// without a second status fetch.
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function RazorpayConnectCard({ projectId, compact = false, onStatusChange }) {
  const [connected, setConnected] = useState(false);
  const [accountId, setAccountId] = useState(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);

  async function checkStatus() {
    let isConnected = false;
    let acctId = null;
    try {
      const res = await fetch(`/api/razorpay/status/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        isConnected = !!data.connected;
        acctId = data.razorpay_account_id || null;
      }
    } catch {}
    setConnected(isConnected);
    setAccountId(acctId);
    setChecking(false);
    onStatusChange?.(isConnected);
  }

  useEffect(() => {
    if (!projectId) return;
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type !== "RAZORPAY_AUTH") return;
      if (event.data.event === "FINISH") {
        setLoading(false);
        toast.success("Razorpay connected!");
        checkStatus();
      } else if (event.data.event === "ERROR") {
        setLoading(false);
        toast.error(event.data.error || "Razorpay connection failed.");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleConnect() {
    setLoading(true);
    try {
      const res = await fetch(`/api/razorpay/connect?projectId=${projectId}`);
      const data = await res.json();
      if (!res.ok || !data.auth_url) {
        toast.error(data.error || "Failed to start Razorpay connection.");
        setLoading(false);
        return;
      }
      window.open(data.auth_url, "razorpay-auth", "width=500,height=700");
    } catch {
      toast.error("Something went wrong.");
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await fetch(`/api/razorpay/disconnect/${projectId}`, { method: "DELETE" });
      setConnected(false);
      setAccountId(null);
      onStatusChange?.(false);
      toast.success("Razorpay disconnected.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />;
  }

  if (connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm bg-white border rounded-xl px-4 py-3">
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <span>Connected via Razorpay OAuth{accountId ? <> — <strong>{accountId}</strong></> : null}</span>
        </div>
        {!compact && (
          <p className="text-xs text-gray-400">
            Your customers pay directly into your Razorpay account. We never touch the money.
          </p>
        )}
        <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={loading}>
          {loading ? "Disconnecting..." : "Disconnect"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Connect your Razorpay account to accept payments — no API keys to copy, just authorize and go.
        We never touch the money; it goes straight into your Razorpay account.
      </p>
      <Button onClick={handleConnect} disabled={loading} className="w-full">
        {loading ? <><Loader2 size={13} className="animate-spin mr-2" />Connecting...</> : "Connect with Razorpay"}
      </Button>
    </div>
  );
}
