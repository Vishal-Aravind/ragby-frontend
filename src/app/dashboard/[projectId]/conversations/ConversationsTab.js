"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Search, Phone, MessageSquare, ArrowLeft, Send, Bot, User, AlertCircle, CheckCircle, StickyNote, UserCircle2, ArrowRightLeft } from "lucide-react";

export default function ConversationsTab({ projectId }) {
  const [chats, setChats]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [messages, setMessages]     = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [search, setSearch]         = useState("");
  const [reply, setReply]           = useState("");
  const [sending, setSending]       = useState(false);
  const [sendError, setSendError]   = useState("");
  const messagesEndRef = useRef(null);
  const pollRef        = useRef(null);
  const chatsPollRef   = useRef(null);
  const textareaRef    = useRef(null);

  // ── Team / assignment / notes ────────────────────────────
  const [me, setMe]               = useState(null);
  const [team, setTeam]           = useState({ owner: null, members: [] });
  const [filterMode, setFilterMode] = useState("all"); // all | mine | unassigned
  const [assigning, setAssigning] = useState(false);
  const [takingOver, setTakingOver] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes]         = useState([]);
  const [history, setHistory]     = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteText, setNoteText]   = useState("");
  const [postingNote, setPostingNote] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user) setMe(d.user); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/team?projectId=${projectId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTeam(d); })
      .catch(() => {});
  }, [projectId]);

  // Everyone who could plausibly be assigned a conversation — owner + active members.
  const people = [
    ...(team.owner?.id ? [{ id: team.owner.id, label: team.owner.name || team.owner.email || "Owner" }] : []),
    ...(team.members || []).filter(m => m.user_id).map(m => ({ id: m.user_id, label: m.email })),
  ];
  const peopleById = Object.fromEntries(people.map(p => [p.id, p.label]));

  // ── Fetch all chats ─────────────────────────────────────
  const fetchChats = useCallback(async () => {
    const res = await fetch(`/api/conversations?project_id=${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setChats(data || []);
      // Update selected chat session mode if changed
      if (selected) {
        const updated = data.find(c => c.id === selected.id);
        if (updated) setSelected(updated);
      }
    }
    setLoading(false);
  }, [projectId, selected?.id]);

  useEffect(() => {
    fetchChats();
    // Poll chats every 10s to update handoff badges
    chatsPollRef.current = setInterval(fetchChats, 10000);
    return () => clearInterval(chatsPollRef.current);
  }, [projectId]);

  // ── Fetch messages for selected chat ────────────────────
  const fetchMessages = useCallback(async (chatId) => {
    const res = await fetch(`/api/conversations/${chatId}/messages`);
    if (res.ok) setMessages((await res.json()) || []);
  }, []);

  const selectChat = async (chat) => {
    setSelected(chat);
    setMessages([]);
    setReply("");
    setSendError("");
    setShowNotes(false);
    setMsgLoading(true);
    await fetchMessages(chat.id);
    setMsgLoading(false);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchMessages(chat.id), 5000);
  };

  // ── Internal notes + assignment history ──────────────────
  const fetchNotes = async (chatId) => {
    setNotesLoading(true);
    const [notesRes, historyRes] = await Promise.all([
      fetch(`/api/conversations/${chatId}/notes`),
      fetch(`/api/conversations/${chatId}/assignment-history`),
    ]);
    if (notesRes.ok) setNotes((await notesRes.json()) || []);
    if (historyRes.ok) setHistory((await historyRes.json()) || []);
    setNotesLoading(false);
  };

  const toggleNotes = async () => {
    const opening = !showNotes;
    setShowNotes(opening);
    if (opening && selected) await fetchNotes(selected.id);
  };

  const postNote = async () => {
    if (!noteText.trim() || !selected) return;
    setPostingNote(true);
    try {
      const res = await fetch(`/api/conversations/${selected.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteText.trim() }),
      });
      if (res.ok) {
        setNoteText("");
        await fetchNotes(selected.id);
      }
    } finally {
      setPostingNote(false);
    }
  };

  // ── Assignment ────────────────────────────────────────────
  const assignChat = async (userId) => {
    if (!selected) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/conversations/${selected.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, assigned_to: userId || null }),
      });
      if (res.ok) {
        setSelected(prev => prev && { ...prev, assigned_to: userId || null });
        await fetchChats();
      }
    } finally {
      setAssigning(false);
    }
  };

  useEffect(() => {
    return () => { clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send reply ──────────────────────────────────────────
  const sendReply = async () => {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    setSendError("");

    // Optimistic update
    const optimistic = { id: `opt_${Date.now()}`, role: "assistant", content: `[Human] ${reply}`, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);
    const msgToSend = reply;
    setReply("");

    const res = await fetch(`/api/conversations/${selected.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, phone_number: selected.external_id, message: msgToSend }),
    });

    if (!res.ok) {
      setSendError("Failed to send. Try again.");
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setReply(msgToSend);
    } else {
      await fetchMessages(selected.id);
    }
    setSending(false);
  };

  // ── Hand back to bot ────────────────────────────────────
  const handBackToBot = async () => {
    await fetch(`/api/conversations/${selected.id}/handback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, phone_number: selected.external_id }),
    });
    await fetchChats();
  };

  // ── Take over from bot (proactive — doesn't need the customer to ask) ──
  const takeOver = async () => {
    if (!selected) return;
    setTakingOver(true);
    try {
      await fetch(`/api/conversations/${selected.id}/takeover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, phone_number: selected.external_id }),
      });
      setSelected(prev => prev && { ...prev, session_mode: "human" });
      await fetchChats();
    } finally {
      setTakingOver(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────
  const formatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts), now = new Date(), diff = now - d;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const formatMsgTime = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

  const isHandoff = selected?.session_mode === "human";

  const filtered = chats.filter(c => {
    const matchSearch =
      (c.external_id || "").includes(search) ||
      (c.title || "").toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterMode === "mine") return me && c.assigned_to === me.id;
    if (filterMode === "unassigned") return !c.assigned_to;
    return true;
  });

  const handoffCount = chats.filter(c => c.session_mode === "human").length;
  const mineCount = me ? chats.filter(c => c.assigned_to === me.id).length : 0;
  const unassignedCount = chats.filter(c => !c.assigned_to).length;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "white" }}>

      {/* ── Left: chat list ── */}
      <div style={{ width: 320, borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <MessageSquare size={18} color="#1e40af" />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0f172a" }}>Conversations</h2>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {handoffCount > 0 && (
                <span style={{ fontSize: 11, background: "#fee2e2", color: "#dc2626", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                  🔴 {handoffCount} handoff
                </span>
              )}
              <span style={{ fontSize: 11, background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
                {chats.length}
              </span>
            </div>
          </div>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px 7px 32px", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#f8fafc" }}
              placeholder="Search by number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { key: "all", label: `All ${chats.length}` },
              { key: "mine", label: `Mine ${mineCount}` },
              { key: "unassigned", label: `Unassigned ${unassignedCount}` },
            ].map(f => (
              <button key={f.key} onClick={() => setFilterMode(f.key)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 20, cursor: "pointer",
                  border: filterMode === f.key ? "1px solid #1e40af" : "1px solid #e2e8f0",
                  background: filterMode === f.key ? "#eff6ff" : "white",
                  color: filterMode === f.key ? "#1e40af" : "#64748b",
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading...</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: "center" }}>
              <MessageSquare size={32} style={{ color: "#cbd5e1", marginBottom: 8 }} />
              <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>No conversations yet</p>
              <p style={{ color: "#cbd5e1", fontSize: 12, margin: "4px 0 0" }}>Messages appear here when users contact you on WhatsApp</p>
            </div>
          )}
          {filtered.map(chat => {
            const isHuman = chat.session_mode === "human";
            const isActive = selected?.id === chat.id;
            return (
              <div key={chat.id} onClick={() => selectChat(chat)}
                style={{
                  padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #f8fafc",
                  background: isActive ? "#eff6ff" : "white",
                  borderLeft: isActive ? "3px solid #3b82f6" : isHuman ? "3px solid #dc2626" : "3px solid transparent",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "white"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ position: "relative" }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: isHuman ? "linear-gradient(135deg, #dc2626, #f97316)" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 700, color: "white", flexShrink: 0,
                    }}>
                      {(chat.external_id || "?").slice(-2)}
                    </div>
                    {isHuman && (
                      <div style={{ position: "absolute", bottom: -1, right: -1, width: 14, height: 14, borderRadius: "50%", background: "#dc2626", border: "2px solid white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 8, color: "white", fontWeight: 700 }}>!</span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {chat.external_id}
                      </p>
                      <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0, marginLeft: 8 }}>
                        {formatTime(chat.last_message_at)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {isHuman && (
                        <span style={{ fontSize: 10, background: "#fee2e2", color: "#dc2626", padding: "1px 5px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>
                          HANDOFF
                        </span>
                      )}
                      <p style={{ fontSize: 12, color: "#64748b", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {chat.last_message || "No messages yet"}
                      </p>
                    </div>
                    {chat.assigned_to && peopleById[chat.assigned_to] && (
                      <p style={{ fontSize: 10, color: "#8b5cf6", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 3 }}>
                        <UserCircle2 size={10} /> {peopleById[chat.assigned_to]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: thread ── */}
      {selected ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

          {/* Chat header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", background: "white", display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => { setSelected(null); setMessages([]); clearInterval(pollRef.current); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4, display: "flex" }}>
              <ArrowLeft size={18} />
            </button>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: isHandoff ? "linear-gradient(135deg, #dc2626, #f97316)" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0,
            }}>
              {(selected.external_id || "?").slice(-2)}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>{selected.external_id}</p>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, display: "flex", alignItems: "center", gap: 3 }}>
                <Phone size={10} /> WhatsApp
                {isHandoff && <span style={{ marginLeft: 6, color: "#dc2626", fontWeight: 600 }}>· Waiting for human reply</span>}
              </p>
            </div>
            <select
              value={selected.assigned_to || ""}
              onChange={e => assignChat(e.target.value || null)}
              disabled={assigning}
              title="Assign this conversation"
              style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "white", color: "#334155", cursor: "pointer" }}
            >
              <option value="">Unassigned</option>
              {people.map(p => (
                <option key={p.id} value={p.id}>{p.id === me?.id ? `${p.label} (you)` : p.label}</option>
              ))}
            </select>
            <button onClick={toggleNotes}
              style={{
                fontSize: 12, padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 600,
                display: "flex", alignItems: "center", gap: 4,
                background: showNotes ? "#eef2ff" : "white",
                color: showNotes ? "#4338ca" : "#64748b",
                border: showNotes ? "1px solid #c7d2fe" : "1px solid #e2e8f0",
              }}>
              <StickyNote size={12} /> {showNotes ? "Back to chat" : "Notes"}
            </button>
            {isHandoff ? (
              <button onClick={handBackToBot}
                style={{ fontSize: 12, padding: "5px 12px", background: "#f0fdf4", color: "#166534", border: "1px solid #86efac", borderRadius: 6, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <Bot size={12} /> Hand back to bot
              </button>
            ) : (
              <button onClick={takeOver} disabled={takingOver}
                style={{ fontSize: 12, padding: "5px 12px", background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe", borderRadius: 6, cursor: takingOver ? "not-allowed" : "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <User size={12} /> {takingOver ? "Taking over..." : "Take over"}
              </button>
            )}
          </div>

          {showNotes ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ flex: 1, overflowY: "auto", padding: "16px", background: "#fffbeb", display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 11, color: "#92400e", margin: "0 0 4px", fontWeight: 600 }}>
                  🔒 Internal notes &amp; assignment history — visible to your team only, never sent to the customer
                </p>
                {notesLoading && <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 16 }}>Loading...</div>}
                {!notesLoading && notes.length === 0 && history.length === 0 && (
                  <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 16 }}>No notes or assignment activity yet</div>
                )}
                {[
                  ...notes.map(n => ({ kind: "note", ...n })),
                  ...history.map(h => ({ kind: "history", ...h })),
                ]
                  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                  .map(item => item.kind === "note" ? (
                    <div key={`note-${item.id}`} style={{ background: "white", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 12px" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#92400e", margin: "0 0 3px" }}>{item.author_name}</p>
                      <p style={{ fontSize: 13, color: "#1f2937", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.content}</p>
                      <p style={{ fontSize: 10, color: "#a16207", margin: "4px 0 0", opacity: 0.8 }}>{formatMsgTime(item.created_at)}</p>
                    </div>
                  ) : (
                    <div key={`hist-${item.id}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 4px" }}>
                      <ArrowRightLeft size={11} style={{ color: "#a855f7", flexShrink: 0 }} />
                      <p style={{ fontSize: 11, color: "#7c3aed", margin: 0, fontStyle: "italic" }}>
                        {item.assigned_to_name ? `Assigned to ${item.assigned_to_name}` : "Unassigned"} by {item.assigned_by_name} · {formatMsgTime(item.created_at)}
                      </p>
                    </div>
                  ))}
              </div>
              <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0", background: "white" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <textarea
                    style={{
                      flex: 1, border: "1px solid #e2e8f0", borderRadius: 8,
                      padding: "8px 12px", fontSize: 13, resize: "none", outline: "none",
                      fontFamily: "inherit", maxHeight: 120, minHeight: 40,
                    }}
                    rows={1}
                    placeholder="Add an internal note..."
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postNote(); } }}
                  />
                  <button onClick={postNote} disabled={!noteText.trim() || postingNote}
                    style={{
                      width: 40, height: 40, borderRadius: 8, border: "none",
                      background: noteText.trim() && !postingNote ? "#d97706" : "#e2e8f0",
                      color: noteText.trim() && !postingNote ? "white" : "#94a3b8",
                      cursor: noteText.trim() && !postingNote ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
          <>
          {/* Handoff banner */}
          {isHandoff && (
            <div style={{ padding: "8px 16px", background: "#fff7ed", borderBottom: "1px solid #fed7aa", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={14} color="#ea580c" />
              <p style={{ fontSize: 12, color: "#ea580c", margin: 0, fontWeight: 500 }}>
                This user requested a human. The bot is paused — reply below to continue the conversation.
              </p>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 8 }}>
            {msgLoading && messages.length === 0 && (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 32 }}>Loading messages...</div>
            )}
            {messages.length === 0 && !msgLoading && (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, marginTop: 32 }}>No messages yet</div>
            )}
            {messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              const isHumanReply = msg.content?.startsWith("[Human]");
              const showDate = idx === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[idx-1]?.created_at).toDateString();
              const displayContent = isHumanReply ? msg.content.replace("[Human] ", "") : msg.content;

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
                      maxWidth: "65%", padding: "8px 12px",
                      borderRadius: isUser ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
                      background: isUser ? "white" : isHumanReply ? "#f0fdf4" : "#1e40af",
                      color: isUser ? "#0f172a" : isHumanReply ? "#166534" : "white",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                      border: isUser ? "1px solid #e2e8f0" : isHumanReply ? "1px solid #86efac" : "none",
                    }}>
                      {isHumanReply && (
                        <p style={{ fontSize: 10, margin: "0 0 3px", fontWeight: 600, color: "#16a34a" }}>You (human reply)</p>
                      )}
                      <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {displayContent}
                      </p>
                      <p style={{ fontSize: 10, margin: "4px 0 0", opacity: 0.6, textAlign: "right" }}>
                        {formatMsgTime(msg.created_at)}
                      </p>
                    </div>
                    {!isUser && (
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%",
                        background: isHumanReply ? "#16a34a" : "#1e40af",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginBottom: 2,
                      }}>
                        {isHumanReply ? <User size={12} color="white" /> : <Bot size={12} color="white" />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply box — only in handoff mode */}
          {isHandoff ? (
            <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0", background: "white" }}>
              {sendError && (
                <p style={{ fontSize: 12, color: "#dc2626", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertCircle size={12} /> {sendError}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea
                  ref={textareaRef}
                  style={{
                    flex: 1, border: "1px solid #e2e8f0", borderRadius: 8,
                    padding: "8px 12px", fontSize: 13, resize: "none", outline: "none",
                    fontFamily: "inherit", maxHeight: 120, minHeight: 40,
                  }}
                  rows={1}
                  placeholder="Type your reply..."
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                />
                <button onClick={sendReply} disabled={!reply.trim() || sending}
                  style={{
                    width: 40, height: 40, borderRadius: 8, border: "none",
                    background: reply.trim() && !sending ? "#1e40af" : "#e2e8f0",
                    color: reply.trim() && !sending ? "white" : "#94a3b8",
                    cursor: reply.trim() && !sending ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    transition: "background 0.15s",
                  }}>
                  <Send size={16} />
                </button>
              </div>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "6px 0 0" }}>Press Enter to send · Shift+Enter for new line</p>
            </div>
          ) : (
            <div style={{ padding: "10px 16px", borderTop: "1px solid #e2e8f0", background: "white" }}>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0, textAlign: "center" }}>
                Read-only · Bot is handling this conversation · Click "Take over" above to reply directly, or the user can trigger handoff by tapping "Talk to Human"
              </p>
            </div>
          )}
          </>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <MessageSquare size={28} color="#3b82f6" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", margin: "0 0 6px" }}>Select a conversation</p>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Choose a contact from the left to view messages</p>
            {handoffCount > 0 && (
              <p style={{ fontSize: 13, color: "#dc2626", margin: "12px 0 0", fontWeight: 500 }}>
                🔴 {handoffCount} conversation{handoffCount > 1 ? "s" : ""} waiting for human reply
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}