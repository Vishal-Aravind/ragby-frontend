"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Copy, Check, Link, Lock, Eye, EyeOff, Loader2, ChevronDown, RefreshCw } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

// ── Integration Item Wrapper ───────────────────────────────
function IntegrationItem({ icon, title, badge, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-2xl border bg-white transition-all duration-300 overflow-hidden ${open ? "shadow-md" : "shadow-sm hover:shadow-md"}`}>
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-5 py-4 group"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-50 border flex items-center justify-center shrink-0">
            {icon}
          </div>
          <span className="font-medium text-sm">{title}</span>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100 font-medium">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div className={`transition-all duration-300 ease-in-out ${open ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="px-5 pb-5 pt-1 border-t bg-gray-50/50 space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function IntegrationsTab({ projectId }) {
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="space-y-3 max-w-2xl">
      <p className="text-xs text-muted-foreground pb-1">Click any integration to expand and configure.</p>

      {/* Shareable Link */}
      <IntegrationItem
        icon={<Link size={16} className="text-blue-500" />}
        title="Shareable Chat Link"
      >
        <ShareableLinkContent projectId={projectId} />
      </IntegrationItem>

      {/* Embed Widget */}
      <IntegrationItem
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-500"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>}
        title="Embeddable Chat Widget"
      >
        <EmbedWidgetContent
          projectId={projectId}
          embedCode={embedCode}
          copied={copied}
          onCopy={handleCopy}
        />
      </IntegrationItem>

      {/* Telegram */}
      <TelegramItem projectId={projectId} />

      {/* Slack */}
      <SlackItem projectId={projectId} />

      {/* Shopify */}
      <ShopifyItem projectId={projectId} />

      {/* WhatsApp */}
      <WhatsAppItem projectId={projectId} />
    </div>
  );
}

// ── WhatsApp Item ──────────────────────────────────────────
function WhatsAppItem({ projectId }) {
  const [connected, setConnected] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const whatsappIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`/api/whatsapp/status/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setConnected(data.connected);
          if (data.display_phone_number) setPhoneNumber(data.display_phone_number);
        }
      } catch {}
      setChecking(false);
    }
    checkStatus();
  }, [projectId]);

  // NOTE: We intentionally do NOT call /api/whatsapp/connect from the
  // postMessage "FINISH" event anymore. That event from Meta's embedded
  // signup popup does not reliably include phone_number_id/waba_id in
  // data.data, which was causing an empty row to overwrite the correct
  // one saved by /api/whatsapp/onboard (which fetches the real IDs via
  // the Graph API using the OAuth code). We only use this listener now
  // to detect CANCEL / ERROR and to stop the loading spinner.
  useEffect(() => {
    const handler = async (event) => {
      if (!event.origin.endsWith("facebook.com")) return;
      let data;
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; }
      catch { return; }

      if (data?.type === "WA_EMBEDDED_SIGNUP") {
        if (data.event === "CANCEL") {
          toast.error("WhatsApp setup cancelled.");
          setLoading(false);
        }
        if (data.event === "ERROR") {
          toast.error("WhatsApp setup error. Please try again.");
          setLoading(false);
        }
        // FINISH is intentionally ignored here — /api/whatsapp/onboard
        // (triggered from the FB.login callback below) is the single
        // source of truth for saving phone_number_id / waba_id.
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [projectId]);

  const launchSignup = () => {
    if (!window.FB) {
      toast.error("Facebook SDK not loaded. Please refresh the page.");
      return;
    }
    setLoading(true);
    window.FB.login(
      (response) => {
        if (!response.authResponse) {
          toast.error("WhatsApp signup cancelled.");
          setLoading(false);
          return;
        }
        // Exchange code via our backend — this is the ONLY path that
        // saves phone_number_id / waba_id, fetched directly from the
        // Graph API (reliable, not dependent on postMessage payload).
        fetch("/api/whatsapp/onboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: response.authResponse.code,
            projectId,
          }),
        })
          .then(async (res) => {
            if (!res.ok) throw new Error();
            const d = await res.json();
            if (!d.phone_number_id) {
              toast.error("Connected, but no phone number was returned. Please try again or check your WhatsApp Business Account.");
              setLoading(false);
              return;
            }
            setConnected(true);
            if (d.display_phone_number) setPhoneNumber(d.display_phone_number);
            toast.success("WhatsApp connected!");
            setLoading(false);
          })
          .catch(() => {
            toast.error("Failed to connect WhatsApp.");
            setLoading(false);
          });
      },
      {
        config_id: process.env.NEXT_PUBLIC_WA_CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          sessionInfoVersion: 2,
        },
      }
    );
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await fetch(`/api/whatsapp/disconnect/${projectId}`, { method: "DELETE" });
      setConnected(false);
      setPhoneNumber("");
      toast.success("WhatsApp disconnected.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <IntegrationItem
      icon={whatsappIcon}
      title="WhatsApp Integration"
      badge={!checking && connected ? "Connected" : undefined}
    >
      {checking ? (
        <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
      ) : connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm bg-white border rounded-xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span>Connected {phoneNumber && <>as <strong>{phoneNumber}</strong></>}</span>
          </div>
          <div className="bg-white border rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-medium">How to use:</p>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5">
              <li>Share your WhatsApp Business number with your customers</li>
              <li>When they send a message, Zavo will reply automatically</li>
              <li>Conversations are tracked per user with memory</li>
            </ol>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={loading}>
            {loading ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your WhatsApp Business number to automatically answer customer messages using your RAG data.
          </p>
          <div className="bg-white border rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs font-medium">What you need:</p>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5">
              <li>A Facebook Business account</li>
              <li>A WhatsApp Business number (not currently on WhatsApp)</li>
            </ol>
          </div>
          <Button onClick={launchSignup} disabled={loading} className="w-full">
            {loading
              ? <><Loader2 size={13} className="animate-spin mr-2" />Opening Meta...</>
              : <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white" className="mr-2">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Connect WhatsApp Business
                </>
            }
          </Button>
        </div>
      )}
    </IntegrationItem>
  );
}

// ── Embed Widget Content ───────────────────────────────────
function EmbedWidgetContent({ projectId, embedCode, copied, onCopy }) {
  const [leadConfig, setLeadConfig] = useState({
    enabled: false,
    triggerAfterMessages: 2,
    formTitle: "Before we continue...",
    formSubtitle: "Please share your details to keep chatting.",
  });
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND}/public/lead-config/${projectId}`)
      .then(r => r.json())
      .then(data => {
        if (data.enabled !== undefined) {
          setLeadConfig({
            enabled: data.enabled,
            triggerAfterMessages: data.trigger_after_messages ?? 2,
            formTitle: data.form_title ?? "Before we continue...",
            formSubtitle: data.form_subtitle ?? "Please share your details to keep chatting.",
          });
        }
      })
      .catch(() => {});
  }, [projectId]);

  const saveLeadConfig = async () => {
    setLeadSaving(true);
    try {
      await fetch("/api/lead-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          enabled: leadConfig.enabled,
          triggerAfterMessages: leadConfig.triggerAfterMessages,
          formTitle: leadConfig.formTitle,
          formSubtitle: leadConfig.formSubtitle,
        }),
      });
      setLeadSaved(true);
      toast.success("Lead capture settings saved");
      setTimeout(() => setLeadSaved(false), 2000);
    } catch {
      toast.error("Failed to save");
    } finally {
      setLeadSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground mb-2">
          Add this script before <code className="bg-gray-100 px-1 rounded text-xs">&lt;/body&gt;</code> on your website.
        </p>
        <div className="relative">
          <pre className="bg-white border rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap font-mono text-gray-700">
            {embedCode}
          </pre>
          <Button size="sm" variant="outline" className="absolute top-2 right-2 h-7 text-xs" onClick={onCopy}>
            {copied ? <><Check size={12} className="mr-1 text-green-500" />Copied</> : <><Copy size={12} className="mr-1" />Copy</>}
          </Button>
        </div>
      </div>

      <div className="border-t" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Lead Capture</p>
            <p className="text-xs text-muted-foreground mt-0.5">Collect visitor name, email & phone after a few messages</p>
          </div>
          <Switch
            checked={leadConfig.enabled}
            onCheckedChange={(val) => setLeadConfig(p => ({ ...p, enabled: val }))}
          />
        </div>

        {leadConfig.enabled && (
          <div className="space-y-3 pl-1">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Show form after how many messages</label>
              <select
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                value={leadConfig.triggerAfterMessages}
                onChange={e => setLeadConfig(p => ({ ...p, triggerAfterMessages: parseInt(e.target.value) }))}
              >
                <option value={1}>1 message</option>
                <option value={2}>2 messages</option>
                <option value={3}>3 messages</option>
                <option value={5}>5 messages</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Form title</label>
              <Input value={leadConfig.formTitle} onChange={e => setLeadConfig(p => ({ ...p, formTitle: e.target.value }))} className="bg-white text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Form subtitle</label>
              <Input value={leadConfig.formSubtitle} onChange={e => setLeadConfig(p => ({ ...p, formSubtitle: e.target.value }))} className="bg-white text-sm" />
            </div>
          </div>
        )}

        <Button onClick={saveLeadConfig} disabled={leadSaving} size="sm" className="w-full">
          {leadSaving ? "Saving..." : leadSaved ? "✓ Saved" : "Save Widget Settings"}
        </Button>
      </div>
    </div>
  );
}

// ── Shareable Link Content ─────────────────────────────────
function ShareableLinkContent({ projectId }) {
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
      body: JSON.stringify({ chat_enabled: enabled, chat_password: password.trim() || null }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Public chat URL</label>
        <div className="flex gap-2">
          <Input value={chatUrl} readOnly className="font-mono text-xs bg-white" />
          <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
            {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white border rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-medium">Link active</p>
          <p className="text-xs text-muted-foreground">{enabled ? "Anyone with the link can chat" : "Link is disabled"}</p>
        </div>
        <button
          onClick={() => setEnabled(p => !p)}
          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${enabled ? "bg-black" : "bg-gray-200"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-1"}`} />
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
          <Lock size={11} /> Password protection
        </label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Leave empty for no password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="pr-10 bg-white text-sm"
          />
          <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-2.5 text-muted-foreground">
            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {password.trim() ? "Users will need this password to access the chat." : "No password — anyone with the link can chat."}
        </p>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
        {saving ? "Saving..." : saved ? "✓ Saved" : "Save settings"}
      </Button>
    </div>
  );
}

// ── Telegram Item ──────────────────────────────────────────
function TelegramItem({ projectId }) {
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
      if (!res.ok) { toast.error(data.detail || "Failed to connect."); return; }
      setConnected(true);
      setBotUsername(data.bot_username);
      setBotToken("");
      toast.success(`@${data.bot_username} connected!`);
    } catch { toast.error("Something went wrong."); }
    finally { setLoading(false); }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await fetch(`/api/telegram/disconnect/${projectId}`, { method: "DELETE" });
      setConnected(false);
      setBotUsername("");
      toast.success("Telegram bot disconnected.");
    } finally { setLoading(false); }
  }

  const telegramIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#229ED9">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
    </svg>
  );

  return (
    <IntegrationItem
      icon={telegramIcon}
      title="Telegram Integration"
      badge={!checking && connected ? "Connected" : undefined}
    >
      {checking ? (
        <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
      ) : connected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm bg-white border rounded-xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span>Connected as <strong>@{botUsername}</strong></span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Private Chat</p>
            <div className="bg-white border rounded-xl px-4 py-3 space-y-1">
              <p className="text-xs text-muted-foreground">Users can message your bot directly on Telegram.</p>
              <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5 mt-1">
                <li>Search <strong>@{botUsername}</strong> on Telegram</li>
                <li>Click <strong>Start</strong></li>
                <li>Ask any question</li>
              </ol>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Group Chat</p>
            <div className="bg-white border rounded-xl px-4 py-3 space-y-2">
              <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5">
                <li>Add <strong>@{botUsername}</strong> to your group</li>
                <li>Go to <strong>@BotFather</strong> → <code>/mybots</code> → Bot Settings → Group Privacy → Turn off</li>
                <li>Remove and re-add the bot to the group</li>
                <li>Mention: <code>@{botUsername} your question</code></li>
              </ol>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <span className="text-amber-500 text-xs mt-0.5">⚠</span>
                <p className="text-xs text-amber-700">Privacy mode must be disabled for group mentions to work.</p>
              </div>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={loading}>
            {loading ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Create a bot via <strong>@BotFather</strong> on Telegram, then paste the token below.</p>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside bg-white border rounded-xl px-4 py-3">
            <li>Open Telegram → search <strong>@BotFather</strong></li>
            <li>Send <code>/newbot</code> and follow the steps</li>
            <li>Copy the token and paste below</li>
          </ol>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              value={botToken}
              onChange={e => setBotToken(e.target.value)}
              className="font-mono text-xs pr-10 bg-white"
            />
            <button type="button" onClick={() => setShowToken(p => !p)} className="absolute right-3 top-2.5 text-muted-foreground">
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <Button onClick={handleConnect} disabled={loading || !botToken.trim()} className="w-full">
            {loading ? <><Loader2 size={13} className="animate-spin mr-2" />Connecting...</> : "Connect Telegram Bot"}
          </Button>
        </div>
      )}
    </IntegrationItem>
  );
}

// ── Slack Item ─────────────────────────────────────────────
function SlackItem({ projectId }) {
  const [connected, setConnected] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      const res = await fetch(`/api/slack/status/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected);
        if (data.team_name) setTeamName(data.team_name);
      }
      setChecking(false);
    }
    checkStatus();
  }, [projectId]);

  async function handleConnect() {
    setLoading(true);
    try {
      const res = await fetch(`/api/slack/connect?projectId=${projectId}`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Something went wrong.");
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await fetch(`/api/slack/disconnect/${projectId}`, { method: "DELETE" });
      setConnected(false);
      setTeamName("");
      toast.success("Slack disconnected.");
    } finally { setLoading(false); }
  }

  const slackIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#E01E5A"/>
    </svg>
  );

  return (
    <IntegrationItem
      icon={slackIcon}
      title="Slack Integration"
      badge={!checking && connected ? "Connected" : undefined}
    >
      {checking ? (
        <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
      ) : connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm bg-white border rounded-xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span>Connected to <strong>{teamName}</strong></span>
          </div>
          <div className="bg-white border rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-medium">How to use:</p>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5">
              <li>Invite the bot to a channel: <code>/invite @Zavo</code></li>
              <li>Mention it: <code>@Zavo what is the pricing?</code></li>
              <li>Or DM the bot directly</li>
            </ol>
          </div>
          <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={loading}>
            {loading ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Connect your Slack workspace to answer questions in channels and DMs.</p>
          <div className="bg-white border rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs font-medium">After connecting:</p>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5">
              <li>Invite the bot to any channel</li>
              <li>Mention <code>@Zavo</code> with your question</li>
              <li>Or DM the bot directly</li>
            </ol>
          </div>
          <Button onClick={handleConnect} disabled={loading} className="w-full">
            {loading ? <><Loader2 size={13} className="animate-spin mr-2" />Connecting...</> : "Connect Slack Workspace"}
          </Button>
        </div>
      )}
    </IntegrationItem>
  );
}

// ── Shopify Item ───────────────────────────────────────────
function ShopifyItem({ projectId }) {
  const [connected, setConnected] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [lastSyncError, setLastSyncError] = useState(null);
  const [sourceId, setSourceId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checking, setChecking] = useState(true);

  async function checkStatus() {
    try {
      const res = await fetch(`/api/shopify/status/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected);
        if (data.shop_domain) setShopDomain(data.shop_domain);
        setLastSyncedAt(data.last_synced_at || null);
        setLastSyncError(data.last_sync_error || null);
        setSourceId(data.source_id || null);
      }
    } catch {}
    setChecking(false);
  }

  useEffect(() => {
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Mirrors AppointmentsTab.js's Google Calendar popup pattern — the OAuth
  // callback (backend/shopify_oauth.py) closes its own popup and posts a
  // SHOPIFY_AUTH message back here, rather than the frontend polling.
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type !== "SHOPIFY_AUTH") return;
      if (event.data.event === "FINISH") {
        setLoading(false);
        toast.success("Shopify connected! Syncing your catalog now...");
        checkStatus();
      } else if (event.data.event === "ERROR") {
        setLoading(false);
        toast.error(event.data.error || "Shopify connection failed.");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleConnect() {
    const shop = domainInput.trim().toLowerCase();
    if (!shop) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/shopify/connect?projectId=${projectId}&shop=${encodeURIComponent(shop)}`);
      const data = await res.json();
      if (!res.ok || !data.auth_url) {
        toast.error(data.error || "Failed to start Shopify connection.");
        setLoading(false);
        return;
      }
      window.open(data.auth_url, "shopify-auth", "width=500,height=700");
    } catch {
      toast.error("Something went wrong.");
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await fetch(`/api/shopify/disconnect/${projectId}`, { method: "DELETE" });
      setConnected(false);
      setShopDomain("");
      setSourceId(null);
      toast.success("Shopify disconnected.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncNow() {
    if (!sourceId) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/sources/sync/${sourceId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sync failed.");
      } else {
        toast.success("Catalog synced.");
        checkStatus();
      }
    } catch {
      toast.error("Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  const shopifyIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M16.5 4.5c-.2-.1-.5-.1-.7 0l-1.1.4c-.2-.6-.6-1.4-1.2-2-.5-.5-1.1-.7-1.7-.7-.2-.3-.5-.4-.8-.4-1.6 0-2.4 2-2.6 3l-1.7.5c-.5.2-.5.2-.6.7L4.5 19.8 16.8 22l4.7-1c0-.1-4.7-16.3-5-16.5z" fill="#95BF47"/>
      <path d="M15.8 4.9c0-.1 0-.1-.1-.2C13.7 3.4 12.6 3 11.9 3c-.2-.3-.5-.4-.8-.4-.5 0-.9.2-1.3.5.6 0 1.2.2 1.7.7.6.6 1 1.4 1.2 2l1.1-.4c.2-.1.5-.1.7 0z" fill="#5E8E3E"/>
      <path d="M11.4 8.7l-.5 1.9s-.6-.3-1.3-.2c-1 0-1 .6-1 .8.1.9 2.4 1.1 2.5 3.2.1 1.6-.9 2.7-2.2 2.8-1.6.1-2.5-.8-2.5-.8l.3-1.5s.9.7 1.7.6c.5 0 .7-.4.6-.7-.1-1.2-2-1.1-2.1-3-.1-1.6 1-3.2 3.2-3.3.9-.1 1.3.2 1.3.2z" fill="#fff"/>
    </svg>
  );

  return (
    <IntegrationItem
      icon={shopifyIcon}
      title="Shopify Integration"
      badge={!checking && connected ? "Connected" : undefined}
    >
      {checking ? (
        <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
      ) : connected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm bg-white border rounded-xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span>Connected to <strong>{shopDomain}</strong></span>
          </div>
          <div className="bg-white border rounded-xl px-4 py-3 space-y-1 text-xs text-muted-foreground">
            {lastSyncError ? (
              <p className="text-red-600">Last sync failed: {lastSyncError}</p>
            ) : lastSyncedAt ? (
              <p>Last synced {new Date(lastSyncedAt).toLocaleString()}</p>
            ) : (
              <p>First sync in progress — this can take a minute for large catalogs.</p>
            )}
            <p>Products sync automatically when you add, edit, or remove them in Shopify.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSyncNow} disabled={syncing || !sourceId}>
              {syncing ? <><Loader2 size={13} className="animate-spin mr-2" />Syncing...</> : <><RefreshCw size={13} className="mr-2" />Sync now</>}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={loading}>
              {loading ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your Shopify store to sync your real catalog — sell through WhatsApp, answer product
            questions in chat, and (with the storefront chat widget installed) let customers check out
            directly on your own site.
          </p>
          <Input
            placeholder="mystore.myshopify.com"
            value={domainInput}
            onChange={e => setDomainInput(e.target.value)}
            className="bg-white text-sm"
          />
          <Button onClick={handleConnect} disabled={loading || !domainInput.trim()} className="w-full">
            {loading ? <><Loader2 size={13} className="animate-spin mr-2" />Connecting...</> : "Connect Shopify Store"}
          </Button>
        </div>
      )}
    </IntegrationItem>
  );
}