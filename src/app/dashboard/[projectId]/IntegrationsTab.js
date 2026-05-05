"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Copy, Check, Link, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

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

      {/* Telegram */}
      <TelegramSection projectId={projectId} />

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
  const [chatUrl, setChatUrl] = useState("");

  useEffect(() => {
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

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Your public chat URL</label>
          <div className="flex gap-2">
            <Input value={chatUrl} readOnly className="font-mono text-sm bg-slate-50" />
            <Button variant="outline" onClick={handleCopy} className="shrink-0">
              {copied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between border rounded-lg px-4 py-3">
          <div>
            <p className="text-sm font-medium">Link active</p>
            <p className="text-xs text-muted-foreground">
              {enabled ? "Anyone with the link can chat" : "Link is disabled — no one can access it"}
            </p>
          </div>
          <button
            onClick={() => setEnabled(p => !p)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-black" : "bg-gray-300"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

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
            <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-2.5 text-muted-foreground">
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {password.trim() ? "Users will be asked for this password before they can chat." : "No password set — anyone with the link can chat."}
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Telegram Section ───────────────────────────────────────
function TelegramSection({ projectId }) {
  const [connected, setConnected] = useState(false);
  const [botUsername, setBotUsername] = useState("");
  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      const res = await fetch(`/api/telegram/status/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected);
        if (data.bot_username) setBotUsername(data.bot_username);
      }
      setChecking(false);
    }
    checkStatus();
  }, [projectId]);

  async function handleConnect() {
    if (!botToken.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: botToken, projectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || "Failed to connect Telegram bot.");
        return;
      }
      setConnected(true);
      setBotUsername(data.bot_username);
      setBotToken("");
      toast.success(`@${data.bot_username} connected!`);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await fetch(`/api/telegram/disconnect/${projectId}`, { method: "DELETE" });
      setConnected(false);
      setBotUsername("");
      toast.success("Telegram bot disconnected.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#229ED9">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
          </svg>
          <h2 className="text-lg font-semibold">Telegram Integration</h2>
        </div>

        {connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Connected as <strong>@{botUsername}</strong></span>
            </div>
            <p className="text-xs text-muted-foreground">
              Your bot is active. Users can message <strong>@{botUsername}</strong> on Telegram to chat with your RAG.
            </p>
            <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={loading}>
              {loading ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Create a bot via <strong>@BotFather</strong> on Telegram, then paste the token below.
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Open Telegram and search <strong>@BotFather</strong></li>
              <li>Send <code>/newbot</code> and follow the steps</li>
              <li>Copy the token and paste it below</li>
            </ol>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                value={botToken}
                onChange={e => setBotToken(e.target.value)}
                className="font-mono text-sm pr-10"
              />
              <button type="button" onClick={() => setShowToken(p => !p)} className="absolute right-3 top-2.5 text-muted-foreground">
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <Button onClick={handleConnect} disabled={loading || !botToken.trim()} className="w-full">
              {loading ? <><Loader2 size={14} className="animate-spin mr-2" />Connecting...</> : "Connect Telegram Bot"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}