"use client";

// app/chat/[projectId]/PublicChatClient.js

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function PublicChatClient({ project, isPasswordProtected }) {
  const [unlocked, setUnlocked] = useState(!isPasswordProtected);
  // Signed, short-lived proof that the password was actually entered.
  // `unlocked` alone is just React state and gated nothing server-side.
  const [accessToken, setAccessToken] = useState(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [checkingPassword, setCheckingPassword] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const storageKey = `ragby_session_${project.id}`;
  const SESSION_TTL = 1000 * 60 * 60 * 3; // 3 hours

  const [sessionId, setSessionId] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey));
        if (stored && Date.now() - stored.timestamp < SESSION_TTL) {
          return stored.id;
        }
      } catch {}
    }
    return null;
  });

  // Durable per-browser id. Distinct from sessionId, which expires after 3
  // hours — the server keys lead capture on this so someone who already gave
  // their details isn't asked again every time their session rolls over.
  const [visitorId] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      let id = localStorage.getItem("ragby_visitor_id");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("ragby_visitor_id", id);
      }
      return id;
    } catch {
      return null;
    }
  });

  // ── Lead capture ────────────────────────────────────
  // This surface had no lead form at all, while the embeddable widget did.
  // Now that the gate is enforced in the backend rather than in the browser,
  // both surfaces hit it, so this page needs a way through.
  const [leadForm, setLeadForm] = useState(null); // { form_title, form_subtitle }
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadError, setLeadError] = useState("");
  const [leadSaving, setLeadSaving] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(null);

  const scrollRef = useRef(null);
  const brandColor = project.brand_color || "#000000";

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load message history on mount if session exists
  useEffect(() => {
    if (!sessionId) return;

    async function loadHistory() {
      const res = await fetch("/api/chat/public/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    }

    loadHistory();
  }, []); // empty deps — runs once on mount

  // ── Password check ──────────────────────────────────
  async function handleUnlock() {
    if (!password.trim()) return;
    setCheckingPassword(true);
    setPasswordError("");

    const res = await fetch(`/api/chat/public/verify-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, password }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      setAccessToken(data.accessToken || null);
      setUnlocked(true);
    } else if (res.status === 429) {
      setPasswordError("Too many attempts — please wait a few minutes and try again.");
    } else {
      setPasswordError("Incorrect password. Please try again.");
    }
    setCheckingPassword(false);
  }

  // ── Send message ────────────────────────────────────
  // `resend` re-asks the question the lead form interrupted, so it skips the
  // input box and the duplicate user bubble that's already on screen.
  async function sendMessage(resend = null) {
    const userMessage = resend ?? input.trim();
    if (!userMessage || loading) return;
    if (!resend) {
      setInput("");
      setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    }
    setLoading(true);

    try {
      const res = await fetch("/api/chat/public/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          message: userMessage,
          sessionId,
          accessToken,
          visitorId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sessionId) {
          setSessionId(data.sessionId);
          try {
            localStorage.setItem(storageKey, JSON.stringify({
              id: data.sessionId,
              timestamp: Date.now(),
            }));
          } catch {}
        }

        // The backend refuses to answer until the visitor shares their
        // details, once the merchant has switched lead capture on.
        if (data.leadRequired) {
          setLeadForm(data.leadForm || {});
          setPendingQuestion(userMessage);
          return;
        }

        setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again."
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, something went wrong. Please try again."
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function submitLead() {
    if (leadSaving) return;
    if (!leadName.trim() || !leadEmail.trim() || !leadPhone.trim()) {
      setLeadError("All fields are required.");
      return;
    }
    setLeadError("");
    setLeadSaving(true);
    try {
      const res = await fetch("/api/chat/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          sessionId: visitorId,
          chatSessionId: sessionId,
          name: leadName.trim(),
          email: leadEmail.trim(),
          phone: leadPhone.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLeadError(data.error || "Couldn't save your details. Please try again.");
        return;
      }

      setLeadForm(null);
      const question = pendingQuestion;
      setPendingQuestion(null);
      if (question) await sendMessage(question);
    } catch {
      setLeadError("Couldn't save your details. Please try again.");
    } finally {
      setLeadSaving(false);
    }
  }

  // ── Password gate ───────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            {project.logo_url && (
              <img src={project.logo_url} className="h-12 mx-auto object-contain" />
            )}
            <h1 className="text-xl font-semibold">{project.name}</h1>
            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
              <Lock size={14} />
              <span>This chat is password protected</span>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleUnlock()}
            />
            {passwordError && (
              <p className="text-xs text-red-500">{passwordError}</p>
            )}
            <Button
              className="w-full"
              style={{ backgroundColor: brandColor }}
              onClick={handleUnlock}
              disabled={checkingPassword || !password.trim()}
            >
              {checkingPassword ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Unlock
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main chat UI ────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="py-4 px-6 flex items-center justify-between shadow-sm bg-white border-b">
        {/* Left — project logo + name */}
        <div className="flex items-center gap-3">
          {project.logo_url && (
            <img src={project.logo_url} alt={project.name} className="h-8 object-contain" />
          )}
          <div>
            <h1 className="font-semibold text-sm">{project.name}</h1>
            {project.domain && (
              <p className="text-xs text-muted-foreground">{project.domain}</p>
            )}
          </div>
        </div>

        {/* Right — Ragby wordmark */}
        <div className="font-semibold text-sm">Zavo</div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl w-full mx-auto">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground mt-12">
            👋 Hi! Ask me anything about {project.name}.
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                msg.role === "user"
                  ? "text-white rounded-br-sm"
                  : "bg-white border rounded-bl-sm text-gray-800"
              }`}
              style={msg.role === "user" ? { backgroundColor: brandColor } : {}}
            >
              {msg.role === "assistant"
                ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )
                : msg.content
              }
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border px-4 py-2.5 rounded-2xl rounded-bl-sm">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Lead capture — shown when the backend refuses to answer until the
            visitor shares their details. */}
        {leadForm && (
          <div className="bg-white border rounded-2xl p-5 max-w-sm mx-auto w-full space-y-3">
            <div className="text-center space-y-1">
              <div className="text-2xl">👋</div>
              <h3 className="text-sm font-semibold">
                {leadForm.form_title || "Before we continue..."}
              </h3>
              <p className="text-xs text-muted-foreground">
                {leadForm.form_subtitle || "Please share your details to keep chatting."}
              </p>
            </div>
            <Input
              placeholder="Your name *"
              value={leadName}
              onChange={e => setLeadName(e.target.value)}
            />
            <Input
              type="email"
              placeholder="Email address *"
              value={leadEmail}
              onChange={e => setLeadEmail(e.target.value)}
            />
            <Input
              type="tel"
              placeholder="Phone number *"
              value={leadPhone}
              onChange={e => setLeadPhone(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitLead()}
            />
            {leadError && <p className="text-xs text-red-500">{leadError}</p>}
            <Button
              className="w-full text-white"
              style={{ backgroundColor: brandColor }}
              onClick={submitLead}
              disabled={leadSaving}
            >
              {leadSaving ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Continue chatting →
            </Button>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder={leadForm ? "Please share your details above to continue" : "Type your message..."}
            disabled={loading || !!leadForm}
            className="flex-1"
          />
          <Button
            // Arrow-wrapped: sendMessage's first parameter is the question to
            // re-send, and a bare handler would hand it the click event.
            onClick={() => sendMessage()}
            disabled={loading || !!leadForm || !input.trim()}
            style={{ backgroundColor: brandColor }}
            className="text-white"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}