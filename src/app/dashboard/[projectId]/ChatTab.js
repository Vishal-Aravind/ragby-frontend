"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppAlertDialog from "@/components/alertdialog";
import {
  Plus,
  MessageSquare,
  Loader2,
  Trash2,
  Pencil,
  Search,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

export default function ChatTab({ projectId }) {
  console.log("NEW ChatTab rendered for project:", projectId);

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // search
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // find-in-chat
  const [matchIds, setMatchIds] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [highlightId, setHighlightId] = useState(null);

  // delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState(null);

  // rename
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [chatToRename, setChatToRename] = useState(null);
  const [newTitle, setNewTitle] = useState("");

  const scrollRef = useRef(null);
  const messageRefs = useRef({});

  // --------------------------------------------------
  // LOAD CHATS / MESSAGES
  // --------------------------------------------------
  useEffect(() => {
    if (!projectId) return;
    loadChats();
  }, [projectId]);

  useEffect(() => {
    if (activeChatId) loadMessages(activeChatId);
    else setMessages([]);
  }, [activeChatId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadChats() {
    const res = await fetch(`/api/chats?projectId=${projectId}`);
    if (!res.ok) return;
    setChats(await res.json());
  }

  async function loadMessages(chatId) {
    const res = await fetch(`/api/chats/${chatId}/messages`);
    if (!res.ok) return;

    const data = await res.json();
    setMessages((data || []).map(m => ({ ...m, showSources: false })));
  }

  // --------------------------------------------------
  // SEARCH
  // --------------------------------------------------
  async function searchChats(query) {
    setSearch(query);

    if (!query.trim()) {
      setSearchResults([]);
      setMatchIds([]);
      setCurrentMatchIndex(0);
      return;
    }

    setSearching(true);

    const res = await fetch(
      `/api/chat/search?projectId=${projectId}&q=${encodeURIComponent(query)}`
    );

    const data = res.ok ? await res.json() : [];

    setSearchResults(data || []);

    const active = data.find(c => c.id === activeChatId);
    if (active?.matches?.length) {
      const ids = active.matches.map(m => m.id);
      setMatchIds(ids);
      setCurrentMatchIndex(0);
      jumpToMatch(ids[0]);
    }

    setSearching(false);
  }

  // --------------------------------------------------
  // FIND NAVIGATION
  // --------------------------------------------------
  function jumpToMatch(messageId) {
    setTimeout(() => {
      const el = messageRefs.current[messageId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightId(messageId);
        setTimeout(() => setHighlightId(null), 1500);
      }
    }, 200);
  }

  const nextMatch = () => {
    if (!matchIds.length) return;
    const next = (currentMatchIndex + 1) % matchIds.length;
    setCurrentMatchIndex(next);
    jumpToMatch(matchIds[next]);
  };

  const prevMatch = () => {
    if (!matchIds.length) return;
    const prev = (currentMatchIndex - 1 + matchIds.length) % matchIds.length;
    setCurrentMatchIndex(prev);
    jumpToMatch(matchIds[prev]);
  };

  // --------------------------------------------------
  // DELETE CHAT
  // --------------------------------------------------
  const requestDeleteChat = (id) => {
    setChatToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteChat = async () => {
    await fetch(`/api/chats/${chatToDelete}`, { method: "DELETE" });

    setChats(prev => prev.filter(c => c.id !== chatToDelete));
    if (activeChatId === chatToDelete) {
      setActiveChatId(null);
      setMessages([]);
    }

    setDeleteDialogOpen(false);
    setChatToDelete(null);
  };

  // --------------------------------------------------
  // RENAME CHAT
  // --------------------------------------------------
  const requestRenameChat = (chat) => {
    setChatToRename(chat);
    setNewTitle(chat.title || "");
    setRenameDialogOpen(true);
  };

  const confirmRenameChat = async () => {
    if (!newTitle.trim()) return;

    await fetch(`/api/chats/${chatToRename.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });

    setChats(prev =>
      prev.map(c =>
        c.id === chatToRename.id ? { ...c, title: newTitle } : c
      )
    );

    setRenameDialogOpen(false);
    setChatToRename(null);
  };

  // --------------------------------------------------
  // SEND MESSAGE
  // --------------------------------------------------
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    let chatId = activeChatId;
    const userContent = input;
    setInput("");
    setLoading(true);

    setMessages(prev => prev.map(m => ({ ...m, showSources: false })));

    if (!chatId) {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: userContent.slice(0, 30),
        }),
      });

      const newChat = await res.json();
      chatId = newChat.id;

      setActiveChatId(chatId);
      setChats(prev => [newChat, ...prev]);
    }

    const userMsgRes = await fetch(`/api/chats/${chatId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "user",
        content: userContent,
      }),
    });

    const userMsg = await userMsgRes.json();
    setMessages(prev => [...prev, userMsg]);

    try {
      const history = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: userContent,
          history,
        }),
      });

      const data = await res.json();

      const assistantRes = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        }),
      });

      const assistantMsg = await assistantRes.json();
      setMessages(prev => [...prev, { ...assistantMsg, showSources: false }]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSources = (index) => {
    setMessages(prev =>
      prev.map((m, i) =>
        i === index ? { ...m, showSources: !m.showSources } : m
      )
    );
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  const visibleChats = search ? searchResults : chats;

return (
  <>
    <div className="flex h-[600px] border rounded-lg overflow-hidden bg-white">
      {/* SIDEBAR */}
      <div className="w-64 border-r bg-slate-50 flex flex-col">
        <div className="p-3 space-y-2">
          <Button
            className="w-full gap-2"
            variant="outline"
            onClick={() => {
              setActiveChatId(null);
              setMessages([]);
              setSearch("");
              setSearchResults([]);
            }}
          >
            <Plus size={16} /> New Chat
          </Button>

          <div className="relative">
            <Search size={14} className="absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              className="pl-7"
              placeholder="Search chats / messages..."
              value={search}
              onChange={(e) => searchChats(e.target.value)}
            />
          </div>

          {matchIds.length > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span>
                {currentMatchIndex + 1} / {matchIds.length}
              </span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={prevMatch}>
                  <ChevronUp size={14} />
                </Button>
                <Button size="icon" variant="ghost" onClick={nextMatch}>
                  <ChevronDown size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {visibleChats.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveChatId(c.id)}
              className={`group flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 ${
                activeChatId === c.id ? "bg-slate-200 font-medium" : ""
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <MessageSquare size={14} />
                <span className="truncate">
                  {c.title || "Untitled Chat"}
                </span>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    requestRenameChat(c);
                  }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    requestDeleteChat(c.id);
                  }}
                  className="text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {visibleChats.length === 0 && !searching && (
            <div className="p-3 text-xs text-muted-foreground">
              No chats yet. Start a new chat.
            </div>
          )}
        </div>
      </div>

      {/* CHAT */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={msg.id || idx}
              ref={(el) => {
                if (msg.id) messageRefs.current[msg.id] = el;
              }}
              className={msg.role === "user" ? "text-right" : ""}
            >
              <div className="inline-block max-w-[80%] p-3 rounded border text-sm whitespace-pre-wrap">
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" size={14} />
              AI is thinking…
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        <div className="p-4 border-t flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type your message..."
            disabled={loading}
          />
          <Button onClick={sendMessage} disabled={loading}>
            Send
          </Button>
        </div>
      </div>
    </div>

    {/* DELETE */}
    <AppAlertDialog
      open={deleteDialogOpen}
      title="Delete chat?"
      description="This chat and all messages will be permanently deleted."
      confirmText="Delete"
      onConfirm={confirmDeleteChat}
      onCancel={() => setDeleteDialogOpen(false)}
    />

    {/* RENAME */}
    <AppAlertDialog
      open={renameDialogOpen}
      title="Rename chat"
      description={
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Enter new title"
        />
      }
      confirmText="Save"
      onConfirm={confirmRenameChat}
      onCancel={() => setRenameDialogOpen(false)}
    />
  </>
);
}