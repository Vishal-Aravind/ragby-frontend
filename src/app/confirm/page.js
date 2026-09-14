
// ─────────────────────────────────────────────────────────
// app/confirm/page.js
// Signup email confirmation — requires an explicit click.
//
// The old flow linked straight to Supabase's /auth/v1/verify endpoint
// ({{ .ConfirmationURL }}), which consumes the one-time token on a plain
// GET. Email providers and corporate security gateways (Gmail, Outlook
// Safe Links) routinely pre-fetch links in incoming mail to scan them for
// phishing — that GET consumes the token before the user ever clicks it,
// so the user's own click then fails with "verification failed", even
// though the account was, in fact, confirmed by the scanner's request.
//
// This page instead receives the raw token_hash (the email template must
// link here directly — see the Supabase dashboard template) and only
// calls verifyOtp() from the browser on an explicit button press. A
// scanner that fetches this page's HTML does not run its JS or click
// its button, so the token survives until the real user acts on it.
// ─────────────────────────────────────────────────────────
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState("idle"); // idle | loading | error
  const [errorMessage, setErrorMessage] = useState("");

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") || "signup";

  const confirm = async () => {
    if (!tokenHash) return;
    setState("loading");
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      setState("error");
      setErrorMessage(error.message || "This link is invalid or has expired.");
      return;
    }
    router.replace("/dashboard");
  };

  if (!tokenHash) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-600">
        This confirmation link is missing its token. Please use the link from your email exactly as sent.
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
        <p className="text-sm text-muted-foreground">
          If you already confirmed this email (some inboxes scan links automatically), just{" "}
          <Link href="/login" className="text-blue-600 hover:underline">sign in</Link>.
          Otherwise, sign up again with the same email to get a new confirmation link.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center">
      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
        <MailCheck size={22} className="text-blue-500" />
      </div>
      <p className="text-sm text-muted-foreground">
        Click below to confirm this is really you, then we'll take you to your dashboard.
      </p>
      <button
        onClick={confirm}
        disabled={state === "loading"}
        className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {state === "loading" && <Loader2 size={14} className="animate-spin" />}
        {state === "loading" ? "Confirming..." : "Confirm my email"}
      </button>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white border rounded-2xl p-8 space-y-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Confirm your email</h1>
        </div>
        <Suspense fallback={null}>
          <ConfirmContent />
        </Suspense>
      </div>
    </div>
  );
}
