"use client";

// ContactDetails.js — the right-hand "Details" panel in Conversations:
// the contact (from Leads) and every answer the flow collected from them.
import { useEffect, useState } from "react";
import { X, User, Mail, Phone, Tag, RefreshCw } from "lucide-react";

const pretty = (k) => k.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
const show = (v) => v === true ? "Yes" : v === false ? "No" : String(v);

export default function ContactDetails({ chatId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${chatId}/details`);
      setData(res.ok ? await res.json() : null);
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [chatId]);

  const c = data?.contact;
  const answers = Object.entries(data?.answers || {});
  const row = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1f2937", margin: "0 0 8px", wordBreak: "break-word" };

  return (
    <div style={{ width: 280, flexShrink: 0, borderLeft: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0", background: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Details</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={load} title="Refresh" style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><RefreshCw size={14} /></button>
          <button onClick={onClose} title="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><X size={15} /></button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {loading && <p style={{ fontSize: 13, color: "#94a3b8" }}>Loading...</p>}

        {!loading && (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 10px" }}>Contact</p>
            {c ? (
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <p style={row}><User size={13} color="#64748b" /> {c.name || <span style={{ color: "#94a3b8" }}>No name yet</span>}</p>
                {c.phone && <p style={row}><Phone size={13} color="#64748b" /> {c.phone}</p>}
                {c.email && <p style={row}><Mail size={13} color="#64748b" /> {c.email}</p>}
                {c.tags?.length > 0 && (
                  <p style={{ ...row, flexWrap: "wrap", margin: 0 }}><Tag size={13} color="#64748b" />
                    {c.tags.map(t => <span key={t} style={{ fontSize: 11, background: "#eef2ff", color: "#4338ca", padding: "1px 7px", borderRadius: 10 }}>{t}</span>)}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 16px" }}>Not saved as a contact yet.</p>
            )}

            <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".04em", margin: "0 0 10px" }}>Collected answers</p>
            {answers.length === 0 ? (
              <p style={{ fontSize: 12, color: "#94a3b8" }}>Nothing collected yet. Answers from &quot;Ask a question&quot; and forms show up here.</p>
            ) : (
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                {answers.map(([k, v], i) => (
                  <div key={k} style={{ padding: "8px 12px", borderTop: i ? "1px solid #f1f5f9" : "none" }}>
                    <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 2px" }}>{pretty(k)}</p>
                    <p style={{ fontSize: 13, color: "#0f172a", margin: 0, wordBreak: "break-word" }}>{show(v)}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
