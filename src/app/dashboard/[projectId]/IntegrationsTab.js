"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Copy, Check, Link, Lock, Eye, EyeOff } from "lucide-react";

export default function IntegrationsTab({ projectId }) {
  const [copied, setCopied] = useState(false);
  const [loadingWA, setLoadingWA] = useState(false);

  const embedCode = `<script\nsrc="https://ragby-backend.onrender.com/static/widget.js"\ndata-project="${projectId}"> </script>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      toast.success("Embed code copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  useEffect(() => {
    const handler = async (event) => {
      if (!event.origin.endsWith("facebook.com")) return;

      let data;
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (data?.type === "WA_EMBEDDED_SIGNUP") {
        if (data.event === "FINISH") {
          const { phone_number_id, waba_id } = data.data || {};
          try {
            await fetch("https://web-production-f2592.up.railway.app/whatsapp/save-metadata", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId, phone_number_id, waba_id }),
            });
          } catch (err) {
            console.error("Metadata save failed", err);
          }
          toast.success("WhatsApp connected");
          setLoadingWA(false);
        }
        if (data.event === "CANCEL") { toast.error("WhatsApp setup cancelled"); setLoadingWA(false); }
        if (data.event === "ERROR") { toast.error("WhatsApp setup error"); setLoadingWA(false); }
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [projectId]);

  const fbLoginCallback = (response) => {
    if (!response.authResponse) { setLoadingWA(false); return; }
    const code = response.authResponse.code;
    fetch("https://web-production-f2592.up.railway.app/whatsapp/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, projectId }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        toast.success("WhatsApp onboarding started");
        setLoadingWA(false);
      })
      .catch(() => {
        toast.error("Failed to connect WhatsApp");
        setLoadingWA(false);
      });
  };

  const launchWhatsAppSignup = () => {
    if (!window.FB) { toast.error("Facebook SDK not loaded"); return; }
    setLoadingWA(true);
    window.FB.login(fbLoginCallback, {
      config_id: "947360908465347",
      response_type: "code",
      override_default_response_type: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Shareable Link — FIX: now actually rendered here */}
      <ShareableLinkSection projectId={projectId} />

      {/* Web Widget */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">Embeddable Chat Widget</h2>
          <p className="text-sm text-muted-foreground">
            Add this script before <code>&lt;/body&gt;</code>.
          </p>
          <div className="relative">
            <pre className="bg-muted border rounded p-4 text-sm overflow-x-auto whitespace-pre-wrap">
              {embedCode}
            </pre>
            <Button size="sm" className="absolute top-2 right-2" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">WhatsApp Integration</h2>
          <p className="text-sm text-muted-foreground">
            Connect a WhatsApp number to this project.
          </p>
          <Button onClick={launchWhatsAppSignup} disabled={loadingWA}>
            {loadingWA ? "Opening Meta..." : "Connect WhatsApp"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Shareable Link Section ─────────────────────────────────
function ShareableLinkSection({ projectId }) {
  const [copied, setCopied] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // FIX: don't use window.location.origin directly — use state to avoid SSR crash
  const [chatUrl, setChatUrl] = useState("");

  useEffect(() => {
    // FIX: set URL client-side only
    setChatUrl(`${window.location.origin}/chat/${projectId}`);

    async function load() {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.chat_enabled ?? true);
        setPassword(data.chat_password || "");
      }
    }
    load();
  }, [projectId]);

  function handleCopy() {
    navigator.clipboard.writeText(chatUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_enabled: enabled,
        chat_password: password.trim() || null,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Link size={18} />
          <h3 className="font-medium">Shareable Chat Link</h3>
        </div>

        {/* Link display + copy */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Your public chat URL</label>
          <div className="flex gap-2">
            <Input
              value={chatUrl}
              readOnly
              className="font-mono text-sm bg-slate-50"
            />
            <Button variant="outline" onClick={handleCopy} className="shrink-0">
              {copied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>

        {/* Enable / Disable toggle */}
        <div className="flex items-center justify-between border rounded-lg px-4 py-3">
          <div>
            <p className="text-sm font-medium">Link active</p>
            <p className="text-xs text-muted-foreground">
              {enabled ? "Anyone with the link can chat" : "Link is disabled — no one can access it"}
            </p>
          </div>
          <button
            onClick={() => setEnabled(p => !p)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              enabled ? "bg-black" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Password protection */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-muted-foreground" />
            <label className="text-sm font-medium">Password protection</label>
          </div>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Leave empty for no password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute right-3 top-2.5 text-muted-foreground"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {password.trim()
              ? "Users will be asked for this password before they can chat."
              : "No password set — anyone with the link can chat."}
          </p>
        </div>

        {/* Save */}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  );
}