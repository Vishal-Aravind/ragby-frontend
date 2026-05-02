"use client";

// app/chat/[projectId]/PublicChatClient.js

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function PublicChatClient({ project, isPasswordProtected }) {
  const [unlocked, setUnlocked] = useState(!isPasswordProtected);
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

  // Add this right after your useState for sessionId
  useEffect(() => {
    console.log("sessionId on mount:", sessionId);
    console.log("localStorage value:", localStorage.getItem(storageKey));
  }, []);

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
      setUnlocked(true);
    } else {
      setPasswordError("Incorrect password. Please try again.");
    }
    setCheckingPassword(false);
  }

  // ── Send message ────────────────────────────────────
  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    setMessages(prev => [...prev, { role: "user", content: userMessage }]);

    const res = await fetch("/api/chat/public/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        message: userMessage,
        sessionId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setSessionId(data.sessionId);
      localStorage.setItem(storageKey, JSON.stringify({
        id: data.sessionId,
        timestamp: Date.now(),
      }));
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } else {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, something went wrong. Please try again."
      }]);
    }

    setLoading(false);
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
        <div className="font-semibold text-sm">Ragby</div>
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

        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
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