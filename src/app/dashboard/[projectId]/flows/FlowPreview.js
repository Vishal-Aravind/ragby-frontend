"use client";

// FlowPreview.js
//
// "Test" panel for website flows: runs the flow through the real engine
// (backend web_flows, via /api/flows/[id]/preview) with nothing saved — no
// chats, no leads, no analytics. AI answers are stubbed. The canvas
// highlights the node the test conversation is on.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, RotateCcw, Loader2, Send } from "lucide-react";

const isSafe = (url, schemes = ["http", "https"]) =>
  typeof url === "string" && schemes.some(s => url.toLowerCase().startsWith(s + ":"));

export default function FlowPreview({ flowId, onClose, onNode, saveFirst }) {
  const [items, setItems] = useState([]);       // rendered conversation
  const [env, setEnv] = useState(null);         // last envelope
  const [token, setToken] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [formValues, setFormValues] = useState({});
  const endRef = useRef(null);

  const call = async (action, nodeId) => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/flows/${flowId}/preview`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: action ? token : null, action, nodeId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.detail || d.error || "Preview failed."); setBusy(false); return; }
      setToken(d.token);
      setEnv(d);
      onNode?.(d.debug?.currentNodeId || null);
      setItems(prev => [...prev, ...(d.messages || []).map(m => ({ who: "bot", m })),
        ...(d.error?.message ? [{ who: "bot", m: { kind: "text", text: `⚠ ${d.error.message}` } }] : [])]);
      setFormValues({});
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(false);
  };

  const restart = async () => {
    setItems([]); setEnv(null); setToken(null);
    if (saveFirst) await saveFirst();
    call(null, null);
  };

  useEffect(() => { restart(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [items, env]);
  useEffect(() => () => onNode?.(null), [onNode]);

  const act = (label, action) => {
    if (busy) return;
    if (label) setItems(prev => [...prev, { who: "you", m: { kind: "text", text: label } }]);
    call(action, env?.nodeId || null);
  };

  const sendText = () => {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    act(t, { type: "text", text: t });
  };

  const input = env?.input;
  const vars = env?.debug?.variables || {};

  return (
    <div style={{ width: 340, flexShrink: 0, borderLeft: "1px solid #e2e8f0", background: "white", display: "flex", flexDirection: "column" }}>
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-semibold">Test this flow</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={restart} title="Restart"><RotateCcw size={14} /></Button>
          <Button variant="ghost" size="sm" onClick={onClose} title="Close"><X size={14} /></Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {items.map((it, i) => <Bubble key={i} who={it.who} m={it.m} />)}
        {env?.delegate === "ai" && <p className="text-[11px] text-center text-muted-foreground">AI would answer here from your documents</p>}
        {env?.continueAfterMs != null && (
          <div className="text-center">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act(null, { type: "continue" })}>
              Skip the {Math.round(env.continueAfterMs / 1000)}s wait
            </Button>
          </div>
        )}

        {input?.kind === "choices" && (
          <div className={`flex gap-1.5 ${input.layout === "chips" ? "flex-wrap" : "flex-col"}`}>
            {input.options.map(o => (
              <Button key={o.id} size="sm" variant="outline" disabled={busy} onClick={() => act(o.label, { type: "choice", id: o.id })}>{o.label}</Button>
            ))}
          </div>
        )}
        {input?.kind === "carousel" && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {input.cards.map((c, i) => (
              <div key={i} className="min-w-[180px] border rounded-lg bg-white p-2 text-xs space-y-1">
                {isSafe(c.image, ["https"]) && <img src={c.image} alt="" className="w-full h-20 object-cover rounded" />}
                <div className="font-semibold">{c.title}</div>
                <div className="text-muted-foreground">{c.text}</div>
                {c.buttons.map((b, j) => b.url
                  ? <a key={j} href={isSafe(b.url, ["http", "https", "tel", "mailto"]) ? b.url : undefined} target="_blank" rel="noreferrer" className="block text-blue-600 underline">{b.label}</a>
                  : <Button key={j} size="sm" variant="outline" className="w-full" disabled={busy} onClick={() => act(`${c.title}: ${b.label}`, { type: "choice", id: b.id })}>{b.label}</Button>)}
              </div>
            ))}
          </div>
        )}
        {input?.kind === "form" && (
          <div className="border rounded-lg bg-white p-2 space-y-1.5">
            {input.title && <div className="text-xs font-semibold">{input.title}</div>}
            {input.fields.map(f => f.type === "consent" ? (
              <label key={f.name} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={!!formValues[f.name]} onChange={e => setFormValues(v => ({ ...v, [f.name]: e.target.checked }))} /> {f.label}
              </label>
            ) : f.type === "choice" ? (
              <select key={f.name} className="w-full border rounded px-2 py-1 text-xs" value={formValues[f.name] || ""}
                onChange={e => setFormValues(v => ({ ...v, [f.name]: e.target.value }))}>
                <option value="">{f.label}</option>
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <Input key={f.name} className="h-8 text-xs" type={f.type === "date" ? "date" : "text"} placeholder={`${f.label}${f.required ? " *" : ""}`}
                value={formValues[f.name] || ""} onChange={e => setFormValues(v => ({ ...v, [f.name]: e.target.value }))} />
            ))}
            {env?.error?.fields && Object.entries(env.error.fields).map(([k, msg]) => <p key={k} className="text-[11px] text-red-600">{k}: {msg}</p>)}
            <Button size="sm" className="w-full" disabled={busy} onClick={() => act("(form submitted)", { type: "form", values: formValues })}>{input.submitLabel || "Send"}</Button>
          </div>
        )}
        {input?.kind === "rating" && (
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: input.style === "nps" ? 11 : 5 }, (_, i) => input.style === "nps" ? i : i + 1).map(v => (
              <Button key={v} size="sm" variant="outline" disabled={busy} onClick={() => act(`Rated ${v}`, { type: "rating", value: v })}>{input.style === "nps" ? v : "★".repeat(v)}</Button>
            ))}
          </div>
        )}
        {input?.kind === "field" && input.type === "date" && (
          <Input type="date" className="h-8 text-xs" onChange={e => e.target.value && act(e.target.value, { type: "field", value: e.target.value })} />
        )}
        {env?.menuChip && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => act("Back to menu", { type: "menu" })}>Back to menu</Button>
        )}
        {env && ["ended", "human"].includes(env.status) && !input && (
          <p className="text-[11px] text-center text-muted-foreground">{env.status === "human" ? "Handed to your team (bot stays quiet)." : "Flow ended."}</p>
        )}
        {busy && <Loader2 size={14} className="animate-spin mx-auto text-muted-foreground" />}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div ref={endRef} />
      </div>

      <div className="flex gap-1.5 p-2 border-t">
        <Input className="h-8 text-xs" placeholder={input?.kind === "field" ? `Type your ${input.type} answer...` : "Type a message..."}
          value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && sendText()} />
        <Button size="sm" onClick={sendText} disabled={busy}><Send size={13} /></Button>
      </div>

      <details className="border-t text-xs">
        <summary className="px-3 py-1.5 cursor-pointer text-muted-foreground">Variables ({Object.keys(vars).length})</summary>
        <div className="px-3 pb-2 font-mono space-y-0.5 max-h-32 overflow-auto">
          {Object.entries(vars).map(([k, v]) => <div key={k}><b>{k}</b> = {String(v)}</div>)}
          {!Object.keys(vars).length && <div className="text-muted-foreground">none yet</div>}
        </div>
      </details>
    </div>
  );
}

function Bubble({ who, m }) {
  const mine = who === "you";
  const cls = `max-w-[85%] rounded-xl px-2.5 py-1.5 text-xs whitespace-pre-wrap break-words ${mine ? "ml-auto bg-indigo-600 text-white" : "bg-white border"}`;
  if (m.kind === "pause") return <p className="text-[10px] text-muted-foreground">… typing {Math.round(m.ms / 1000)}s</p>;
  if (m.kind === "image") return <div className={cls}>{isSafe(m.url, ["https"]) && <img src={m.url} alt="" className="rounded max-h-40" />}{m.caption}</div>;
  if (m.kind === "video" || m.kind === "audio" || m.kind === "file") return <div className={cls}>[{m.kind}] {m.name || ""} {m.caption}</div>;
  if (m.kind === "link") return <div className={cls}>{m.text}{m.text ? "\n" : ""}<span className="underline text-blue-600">{m.label}</span></div>;
  if (m.kind === "card") return <div className={cls}>{m.title && <b>{m.title}{"\n"}</b>}{m.text}{(m.links || []).map(l => `\n[${l.label}]`).join("")}</div>;
  return <div className={cls}>{m.text}</div>;
}
