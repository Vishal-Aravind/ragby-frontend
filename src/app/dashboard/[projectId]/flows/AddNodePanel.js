"use client";

// AddNodePanel.js
//
// Permanently docked alongside the canvas (not a button you have to click
// to summon an overlay) — every node type, categorized, with a
// description and a search box, always visible while editing a flow.
// Replaces the old two-entry-point add flow: a toolbar button that always
// dropped a blank "message" node (type picked afterward via a dropdown
// rendered INSIDE that node), plus a separate drag-only sidebar with a
// different set of node types.
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { NODE_REGISTRY, CATEGORIES } from "./nodeRegistry";

export default function AddNodePanel({ onSelect }) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? NODE_REGISTRY.filter(n =>
          n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q))
      : NODE_REGISTRY;
    return CATEGORIES
      .map(cat => ({ category: cat, nodes: filtered.filter(n => n.category === cat) }))
      .filter(g => g.nodes.length > 0);
  }, [query]);

  return (
    <div
      data-tour="flows-add-node"
      style={{ width: 260, flexShrink: 0, borderLeft: "1px solid #e2e8f0", background: "white", display: "flex", flexDirection: "column" }}
    >
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #e2e8f0" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", margin: "0 0 8px" }}>Add a node</p>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <Input
            placeholder="Search node types..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-7 h-8 text-sm"
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 16 }}>
        {grouped.length === 0 && (
          <p style={{ fontSize: 13, color: "#94a3b8" }}>No node types match "{query}".</p>
        )}
        {grouped.map(({ category, nodes }) => (
          <div key={category}>
            <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", margin: "0 0 6px" }}>
              {category}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {nodes.map(n => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.type}
                    onClick={() => onSelect(n.type)}
                    style={{
                      textAlign: "left", display: "flex", alignItems: "flex-start", gap: 8,
                      borderRadius: 8, border: "1px solid #e2e8f0", padding: "8px 9px",
                      background: "white", cursor: "pointer", transition: "border-color 0.1s, background 0.1s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#94a3b8"; e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "white"; }}
                  >
                    <span style={{ width: 24, height: 24, borderRadius: 6, background: n.badge, color: n.text, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={13} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#1f2937" }}>{n.label}</span>
                      <span style={{ display: "block", fontSize: 11, color: "#94a3b8", lineHeight: 1.35, marginTop: 1 }}>{n.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
