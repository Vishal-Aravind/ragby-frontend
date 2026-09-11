"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createBrowserClient } from "@supabase/ssr";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);

  // Supabase delivers the recovery token in the URL fragment, which never
  // reaches the server. The browser client reads it, establishes the
  // recovery session, and only then can the confirm route (which
  // re-validates server-side) do anything.
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    // Already-established session (e.g. a refresh of this page).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else {
        // Give the fragment a moment to be consumed before declaring the
        // link dead, otherwise a slow parse shows a false error.
        setTimeout(() => setReady((r) => { if (!r) setInvalid(true); return r; }), 2000);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not reset your password");
        return;
      }
      toast.success("Password updated. Please sign in.");
      router.replace("/login");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white border rounded-2xl p-8 space-y-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        </div>

        {invalid ? (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-600">
              This reset link is invalid or has expired. Please request a new one.
            </div>
            <Link
              href="/forgot-password"
              className="block w-full text-center py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Request a new link
            </Link>
          </div>
        ) : !ready ? (
          <div className="flex justify-center py-4">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <button
              onClick={submit}
              disabled={loading}
              className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Updating..." : "Update password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
