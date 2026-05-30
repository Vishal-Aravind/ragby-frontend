"use client";

import { useEffect, useState, useRef } from "react";
import { Search, Phone, MessageSquare, Clock, ChevronRight, ArrowLeft, Send, Bot, User } from "lucide-react";

export default function ConversationsTab({ projectId }) {
  const [chats, setChats]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [messages, setMessages]     = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [search, setSearch]         = useState("");
  const messagesEndRef = useRef(null);
  const pollRef        = useRef(null);

  // ── Load all chats ──────────────────────────────────────
  const fetchChats = async () => {
    const res = await fetch(`/api/conversations?project_id=${projectId}`);
    if (res.ok) setChats((await res.json()) || []);
    setLoading(false);
  };

  useEffect(() => { fetchChats(); }, [projectId]);

  // ── Load messages for selected chat ────────────────────
  const fetchMessages = async (chatId) => {
    setMsgLoading(true);
    const res = await fetch(`/api/conversations/${chatId}/messages`);
    if (res.ok) setMessages((await res.json()) || []);
    setMsgLoading(false);
  };

  const selectChat = async (chat) => {
    setSelected(chat);
    await fetchMessages(chat.id);
    // Poll for new messages every 5s
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchMessages(chat.id), 5000);
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filtered = chats.filter(c =>
    (c.external_id || "").includes(search) ||
    (c.title || "").toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const formatMsgTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{
      display: "flex", height: "calc(100vh - 120px)", border: "1px solid #e2e8f0",
      borderRadius: 12, overflow: "hidden", background: "white",
    }}>

      {/* ── Left: chat list ── */}
      <div style={{
        width: selected ? 320 : "100%", maxWidth: 360, borderRight: "1px solid #e2e8f0",
        display: "flex", flexDirection: "column", flexShrink: 0,
        transition: "width 0.2s",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <MessageSquare size={18} color="#1e40af" />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0f172a" }}>Conversations</h2>
            <span style={{ fontSize: 12, background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 20, fontWeight: 600, marginLeft: "auto" }}>
              {chats.length}
            </span>
          </div>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px 7px 32px", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#f8fafc" }}
              placeholder="Search by number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Chat list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading...</div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: "center" }}>
              <MessageSquare size={32} style={{ color: "#cbd5e1", marginBottom: 8 }} />
              <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>No conversations yet</p>
              <p style={{ color: "#cbd5e1", fontSize: 12, margin: "4px 0 0" }}>Messages will appear here when users contact you</p>
            </div>
          )}
          {filtered.map(chat => (
            <div key={chat.id}
              onClick={() => selectChat(chat)}
              style={{
                padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #f8fafc",
                background: selected?.id === chat.id ? "#eff6ff" : "white",
                borderLeft: selected?.id === chat.id ? "3px solid #3b82f6" : "3px solid transparent",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (selected?.id !== chat.id) e.currentTarget.style.background = "#f8fafc"; }}
              onMouseLeave={e => { if (selected?.id !== chat.id) e.currentTarget.style.background = "white"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: "white",
                }}>
                  {(chat.external_id || "?").slice(-2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {chat.external_id}
                    </p>
                    <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0, marginLeft: 8 }}>
                      {formatTime(chat.last_message_at || chat.created_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {chat.last_message || "No messages yet"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: message thread ── */}
      {selected ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Chat header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", background: "white", display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => { setSelected(null); setMessages([]); if (pollRef.current) clearInterval(pollRef.current); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4, display: "flex" }}>
              <ArrowLeft size={18} />
            </button>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0 }}>
              {(selected.external_id || "?").slice(-2)}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>{selected.external_id}</p>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, display: "flex", alignItems: "center", gap: 3 }}>
                <Phone size={10} /> WhatsApp
              </p>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 8 }}>
            {msgLoading && messages.length === 0 && (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 32 }}>Loading messages...</div>
            )}
            {messages.length === 0 && !msgLoading && (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 32 }}>No messages in this conversation</div>
            )}
            {messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              const showDate = idx === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[idx-1]?.created_at).toDateString();
              return (
                <div key={msg.id || idx}>
                  {showDate && (
                    <div style={{ textAlign: "center", margin: "8px 0" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8", background: "#e2e8f0", padding: "2px 10px", borderRadius: 20 }}>
                        {new Date(msg.created_at).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: isUser ? "flex-start" : "flex-end", alignItems: "flex-end", gap: 6 }}>
                    {isUser && (
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 2 }}>
                        <User size={12} color="white" />
                      </div>
                    )}
                    <div style={{
                      maxWidth: "65%", padding: "8px 12px", borderRadius: isUser ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
                      background: isUser ? "white" : "#1e40af",
                      color: isUser ? "#0f172a" : "white",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                      border: isUser ? "1px solid #e2e8f0" : "none",
                    }}>
                      <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {msg.content}
                      </p>
                      <p style={{ fontSize: 10, margin: "4px 0 0", opacity: 0.6, textAlign: "right" }}>
                        {formatMsgTime(msg.created_at)}
                      </p>
                    </div>
                    {!isUser && (
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1e40af", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 2 }}>
                        <Bot size={12} color="white" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer note */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid #e2e8f0", background: "white" }}>
            <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, textAlign: "center" }}>
              Read-only view · Replies are sent automatically by the AI
            </p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <MessageSquare size={28} color="#3b82f6" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", margin: "0 0 6px" }}>Select a conversation</p>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Choose a contact from the left to view messages</p>
          </div>
        </div>
      )}
    </div>
  );
}