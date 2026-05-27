"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  Panel,
  NodeToolbar,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, X, ChevronDown, Info, Settings, Check } from "lucide-react";
import AppAlertDialog from "@/components/alertdialog";

const NODE_COLORS = {
  text:    { bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#dcfce7" },
  buttons: { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", badge: "#dbeafe" },
  list:    { bg: "#faf5ff", border: "#c4b5fd", text: "#5b21b6", badge: "#ede9fe" },
  rag:     { bg: "#fffbeb", border: "#fcd34d", text: "#78350f", badge: "#fef3c7" },
  cta_url: { bg: "#fff7ed", border: "#fdba74", text: "#9a3412", badge: "#ffedd5" },
  handoff: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", badge: "#fee2e2" },
};

const NODE_LABELS = {
  text: "Text", buttons: "Buttons", list: "List",
  rag: "AI Answer", cta_url: "Send Link", handoff: "Handoff",
};

const NODE_TYPES_LIST = [
  { value: "text",    label: "Text",      emoji: "💬" },
  { value: "buttons", label: "Buttons",   emoji: "🔘" },
  { value: "list",    label: "List",      emoji: "📋" },
  { value: "rag",     label: "AI Answer", emoji: "🤖" },
  { value: "cta_url", label: "Send Link", emoji: "🔗" },
  { value: "handoff", label: "Handoff",   emoji: "👤" },
];

const RESERVED_IDS = [
  { id: "ask_a_question", label: "Ask a Question", desc: "→ RAG mode" },
  { id: "back_to_menu",   label: "↩ Back to Menu", desc: "→ Restart flow" },
  { id: "talk_to_human",  label: "Talk to Human",  desc: "→ Handoff" },
];

const EMPTY_CONTENT = {
  text:    { body: "" },
  buttons: { body: "", buttons: [{ id: "", title: "" }] },
  list:    { body: "", button_text: "View Options", sections: [{ title: "", rows: [{ id: "", title: "" }] }] },
  rag:     { body: "Ask me anything!" },
  cta_url: { body: "", button_text: "Click Here", url: "" },
  handoff: { body: "Connecting you to our team. Please wait..." },
};

// ─────────────────────────────────────────────────────────
// ID PICKER — small inline dropdown
// ─────────────────────────────────────────────────────────
function IdPicker({ value, onChange, placeholder = "Select or type ID..." }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const reserved = RESERVED_IDS.find(r => r.id === value);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setInput(""); }}
        className="w-full flex items-center justify-between border rounded px-2 py-1 text-xs bg-white hover:border-blue-400 transition-colors"
      >
        <span className={value ? "text-gray-800 font-mono" : "text-gray-400"}>{value || placeholder}</span>
        <ChevronDown size={11} className="text-gray-400 shrink-0 ml-1" />
      </button>
      {reserved && <p className="text-xs text-amber-600 mt-0.5 pl-1">✓ {reserved.desc}</p>}

      {open && (
        <div className="absolute z-[999] left-0 top-full mt-1 w-56 bg-white border rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b">
            <input
              autoFocus
              className="w-full text-xs border rounded px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-blue-300"
              placeholder="type custom id..."
              value={input}
              onChange={e => setInput(e.target.value.replace(/\s/g, "_").toLowerCase())}
              onKeyDown={e => {
                if (e.key === "Enter" && input) { onChange(input); setOpen(false); }
              }}
            />
          </div>
          <div className="py-1">
            <p className="text-xs text-gray-400 px-3 py-1 font-medium">Special actions</p>
            {RESERVED_IDS.map(r => (
              <button key={r.id} type="button"
                onClick={() => { onChange(r.id); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-amber-50 transition-colors ${value === r.id ? "bg-amber-50" : ""}`}
              >
                <div>
                  <p className="text-xs font-mono text-blue-600">{r.id}</p>
                  <p className="text-xs text-gray-400">{r.desc}</p>
                </div>
                {value === r.id && <Check size={11} className="text-amber-600" />}
              </button>
            ))}
          </div>
          {input && (
            <div className="border-t">
              <button type="button"
                onClick={() => { onChange(input); setOpen(false); }}
                className="w-full px-3 py-2 text-left text-xs text-blue-600 hover:bg-blue-50 font-mono"
              >
                Use "{input}"
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CUSTOM FLOW NODE — expanded config lives inside
// ─────────────────────────────────────────────────────────
function FlowNode({ id, data, selected }) {
  const colors = NODE_COLORS[data.type] || NODE_COLORS.text;
  const [expanded, setExpanded] = useState(false);
  const [type, setType] = useState(data.type);
  const [content, setContent] = useState(data.content || {});
  const [isStart, setIsStart] = useState(data.isStart || false);
  const [saving, setSaving] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  // Sync when external data changes
  useEffect(() => {
    setType(data.type);
    setContent(data.content || {});
    setIsStart(data.isStart || false);
  }, [data.type, data.content, data.isStart]);

  const updateContent = (key, val) => setContent(prev => ({ ...prev, [key]: val }));

  const updateButton = (idx, field, val) => {
    const btns = [...(content.buttons || [])];
    btns[idx] = { ...btns[idx], [field]: val };
    updateContent("buttons", btns);
  };

  const addButton = () => {
    if ((content.buttons || []).length >= 3) return;
    updateContent("buttons", [...(content.buttons || []), { id: "", title: "" }]);
  };

  const removeButton = (idx) => {
    const btns = [...(content.buttons || [])];
    btns.splice(idx, 1);
    updateContent("buttons", btns);
  };

  const updateListRow = (sIdx, rIdx, field, val) => {
    const sections = JSON.parse(JSON.stringify(content.sections || []));
    sections[sIdx].rows[rIdx][field] = val;
    updateContent("sections", sections);
  };

  const addListRow = (sIdx) => {
    const sections = JSON.parse(JSON.stringify(content.sections || []));
    sections[sIdx].rows.push({ id: "", title: "" });
    updateContent("sections", sections);
  };

  const removeListRow = (sIdx, rIdx) => {
    const sections = JSON.parse(JSON.stringify(content.sections || []));
    sections[sIdx].rows.splice(rIdx, 1);
    updateContent("sections", sections);
  };

  const handleSave = async () => {
    setSaving(true);
    await data.onSave(id, { type, content, is_start: isStart });
    setSaving(false);
    setExpanded(false);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    data.onDelete(id);
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    setContent(EMPTY_CONTENT[newType]);
    setShowTypePicker(false);
  };

  const nodeColors = NODE_COLORS[type] || NODE_COLORS.text;

  return (
    <div
      style={{
        background: nodeColors.bg,
        border: `2px solid ${selected ? "#3b82f6" : nodeColors.border}`,
        borderRadius: 12,
        minWidth: expanded ? 280 : 190,
        maxWidth: expanded ? 320 : 220,
        boxShadow: selected ? "0 0 0 3px rgba(59,130,246,0.2)" : "0 2px 8px rgba(0,0,0,0.08)",
        transition: "all 0.15s",
        fontFamily: "inherit",
      }}
      className="nodrag"
      onClick={e => e.stopPropagation()}
    >
      <Handle type="target" position={Position.Top}
        style={{ background: nodeColors.border, width: 10, height: 10, top: -6 }}
        className="nodrag"
      />

      {/* ── Node header ── */}
      <div
        style={{ padding: "8px 12px", cursor: "pointer" }}
        className="drag-handle"
        onMouseDown={e => e.currentTarget.closest('.react-flow__node') && (e.currentTarget.closest('.react-flow__node').style.cursor = 'grabbing')}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Type badge — clickable to change type */}
            <button
              onClick={e => { e.stopPropagation(); setShowTypePicker(p => !p); }}
              style={{
                fontSize: 10, fontWeight: 600, padding: "2px 8px",
                borderRadius: 20, background: nodeColors.badge, color: nodeColors.text,
                textTransform: "uppercase", letterSpacing: "0.05em", border: "none",
                cursor: "pointer",
              }}
            >
              {NODE_LABELS[type]} ▾
            </button>
            {isStart && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 7px",
                borderRadius: 20, background: "#fef3c7", color: "#92400e",
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}>Start</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={e => { e.stopPropagation(); handleDelete(e); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", padding: 2 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>

        {/* Type picker dropdown */}
        {showTypePicker && (
          <div
            style={{
              position: "absolute", zIndex: 999, top: "100%", left: 0,
              background: "white", border: "1px solid #e2e8f0",
              borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              padding: "4px", minWidth: 160,
            }}
            onClick={e => e.stopPropagation()}
          >
            {NODE_TYPES_LIST.map(t => (
              <button
                key={t.value}
                onClick={() => handleTypeChange(t.value)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "6px 10px", border: "none",
                  background: type === t.value ? "#eff6ff" : "none",
                  borderRadius: 6, cursor: "pointer", fontSize: 13,
                  color: type === t.value ? "#1e40af" : "#374151",
                  fontWeight: type === t.value ? 600 : 400,
                }}
              >
                <span>{t.emoji}</span><span>{t.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Preview text */}
        <p style={{
          fontSize: 13, color: "#374151", margin: "4px 0 0",
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: expanded ? 10 : 2,
          WebkitBoxOrient: "vertical", lineHeight: 1.4,
        }}>
          {content.body || <span style={{ color: "#9ca3af" }}>Click to configure...</span>}
        </p>
      </div>

      {/* ── Expanded config area ── */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${nodeColors.border}`, padding: "10px 12px" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Start node toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, cursor: "pointer", fontSize: 12 }}>
            <input type="checkbox" checked={isStart} onChange={e => setIsStart(e.target.checked)} />
            Set as start node
          </label>

          {/* Message body */}
          <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Message</p>
          <textarea
            style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 8px", fontSize: 12, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            rows={type === "text" ? 3 : 2}
            value={content.body || ""}
            onChange={e => updateContent("body", e.target.value)}
            placeholder="Enter your message..."
            onClick={e => e.stopPropagation()}
          />

          {/* ── Buttons config ── */}
          {type === "buttons" && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Buttons (max 3)</p>
              {(content.buttons || []).map((btn, idx) => (
                <div key={idx} style={{ marginBottom: 8, background: "white", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 8px" }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                    <input
                      style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px 6px", fontSize: 12, outline: "none" }}
                      placeholder="Button label"
                      value={btn.title}
                      onChange={e => updateButton(idx, "title", e.target.value)}
                      onClick={e => e.stopPropagation()}
                    />
                    <button onClick={() => removeButton(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171" }}>✕</button>
                  </div>
                  <IdPicker value={btn.id} onChange={val => updateButton(idx, "id", val)} placeholder="Select action or ID..." />
                </div>
              ))}
              {(content.buttons || []).length < 3 && (
                <button
                  onClick={addButton}
                  style={{ width: "100%", border: "1px dashed #cbd5e1", borderRadius: 6, padding: "4px", fontSize: 12, background: "none", cursor: "pointer", color: "#64748b" }}
                >
                  + Add button
                </button>
              )}
            </div>
          )}

          {/* ── List config ── */}
          {type === "list" && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Button text</p>
              <input
                style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
                placeholder="View Options"
                value={content.button_text || ""}
                onChange={e => updateContent("button_text", e.target.value)}
                onClick={e => e.stopPropagation()}
              />
              {(content.sections || []).map((section, sIdx) => (
                <div key={sIdx} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>
                  <input
                    style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px 6px", fontSize: 12, outline: "none", marginBottom: 6, boxSizing: "border-box" }}
                    placeholder="Section title"
                    value={section.title}
                    onChange={e => { const s = JSON.parse(JSON.stringify(content.sections)); s[sIdx].title = e.target.value; updateContent("sections", s); }}
                    onClick={e => e.stopPropagation()}
                  />
                  {section.rows.map((row, rIdx) => (
                    <div key={rIdx} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", gap: 4, marginBottom: 3 }}>
                        <input
                          style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px 6px", fontSize: 12, outline: "none" }}
                          placeholder="Row title"
                          value={row.title}
                          onChange={e => updateListRow(sIdx, rIdx, "title", e.target.value)}
                          onClick={e => e.stopPropagation()}
                        />
                        <button onClick={() => removeListRow(sIdx, rIdx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171" }}>✕</button>
                      </div>
                      <IdPicker value={row.id} onChange={val => updateListRow(sIdx, rIdx, "id", val)} placeholder="Select action or ID..." />
                    </div>
                  ))}
                  <button
                    onClick={() => addListRow(sIdx)}
                    style={{ width: "100%", border: "1px dashed #cbd5e1", borderRadius: 4, padding: "3px", fontSize: 11, background: "none", cursor: "pointer", color: "#64748b" }}
                  >
                    + Add row
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── CTA URL config ── */}
          {type === "cta_url" && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none" }}
                placeholder="Button text"
                value={content.button_text || ""}
                onChange={e => updateContent("button_text", e.target.value)}
                onClick={e => e.stopPropagation()}
              />
              <input
                style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", fontFamily: "monospace" }}
                placeholder="https://yoursite.com?wa={{phone_number}}"
                value={content.url || ""}
                onChange={e => updateContent("url", e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          {/* ── RAG info ── */}
          {type === "rag" && (
            <p style={{ fontSize: 11, color: "#92400e", background: "#fef3c7", borderRadius: 6, padding: "6px 8px", marginTop: 6 }}>
              Every AI answer gets a [Back to Menu] button automatically.
            </p>
          )}

          {/* ── Handoff info ── */}
          {type === "handoff" && (
            <p style={{ fontSize: 11, color: "#991b1b", background: "#fee2e2", borderRadius: 6, padding: "6px 8px", marginTop: 6 }}>
              Session switches to human mode after this message.
            </p>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              marginTop: 10, width: "100%", background: "#1e40af", color: "white",
              border: "none", borderRadius: 6, padding: "6px", fontSize: 12,
              fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}
          >
            {saving ? "Saving..." : "✓ Save"}
          </button>
        </div>
      )}

      <Handle type="source" position={Position.Bottom}
        style={{ background: nodeColors.border, width: 10, height: 10, bottom: -6 }}
      />
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode };

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────
export default function FlowsTab({ projectId }) {
  const [flows, setFlows]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [dbNodes, setDbNodes]           = useState([]);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);
  const [creatingFlow, setCreatingFlow] = useState(false);
  const [newFlowName, setNewFlowName]   = useState("");
  const [showFlowList, setShowFlowList] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editKeywords, setEditKeywords] = useState("");
  const [editFreeQ, setEditFreeQ]       = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteFlowOpen, setDeleteFlowOpen] = useState(false);
  const [flowToDelete, setFlowToDelete]     = useState(null);
  const [deleteNodeId, setDeleteNodeId]     = useState(null);
  const [deleteNodeOpen, setDeleteNodeOpen] = useState(false);

  const fetchFlows = async () => {
    setLoading(true);
    const res = await fetch(`/api/flows?project_id=${projectId}`);
    if (res.ok) setFlows((await res.json()) || []);
    setLoading(false);
  };

  useEffect(() => { fetchFlows(); }, [projectId]);

  const fetchNodes = useCallback(async (flowId) => {
    const res = await fetch(`/api/flows/${flowId}/nodes`);
    if (!res.ok) return;
    const data = await res.json();
    setDbNodes(data.nodes || []);
    buildGraph(data.nodes || [], data.edges || [], flowId);
  }, []);

  const buildGraph = (nodes, edges, flowId) => {
    const rfN = nodes.map((n, i) => ({
      id: n.id,
      type: "flowNode",
      position: { x: 120 + (i % 3) * 300, y: Math.floor(i / 3) * 200 + 60 },
      dragHandle: ".drag-handle",
      data: {
        type: n.type,
        content: n.content,
        isStart: n.is_start,
        onSave: async (nodeId, updates) => {
          await fetch(`/api/flows/nodes/${nodeId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });
          await fetchNodes(flowId);
        },
        onDelete: (nodeId) => {
          setDeleteNodeId(nodeId);
          setDeleteNodeOpen(true);
        },
      },
    }));

    const rfE = edges.map(e => ({
      id: e.id,
      source: e.from_node_id,
      target: e.to_node_id,
      label: e.trigger,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
      style: { stroke: "#94a3b8", strokeWidth: 2 },
      labelStyle: { fontSize: 11, fill: "#64748b" },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
    }));

    setRfNodes(rfN);
    setRfEdges(rfE);
  };

  const selectFlow = async (flow) => {
    setSelectedFlow(flow);
    setEditKeywords((flow.trigger_keywords || []).join(", "));
    setEditFreeQ(flow.free_questions || false);
    setShowFlowList(false);
    await fetchNodes(flow.id);
  };

  const handleCreateFlow = async () => {
    if (!newFlowName.trim()) return;
    setCreatingFlow(true);
    const res = await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, name: newFlowName.trim() }),
    });
    if (res.ok) {
      const flow = await res.json();
      setNewFlowName("");
      await fetchFlows();
      await selectFlow(flow);
    }
    setCreatingFlow(false);
  };

  const handleSaveSettings = async () => {
    if (!selectedFlow) return;
    setSavingSettings(true);
    const keywords = editKeywords.split(",").map(k => k.trim()).filter(Boolean);
    await fetch(`/api/flows/${selectedFlow.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger_keywords: keywords, free_questions: editFreeQ }),
    });
    setSelectedFlow(f => ({ ...f, trigger_keywords: keywords, free_questions: editFreeQ }));
    await fetchFlows();
    setSavingSettings(false);
    setSettingsOpen(false);
  };

  const toggleActive = async (flow, e) => {
    e?.stopPropagation();
    await fetch(`/api/flows/${flow.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !flow.is_active }),
    });
    await fetchFlows();
    if (selectedFlow?.id === flow.id)
      setSelectedFlow(f => ({ ...f, is_active: !f.is_active }));
  };

  const handleAddNode = async (type) => {
    if (!selectedFlow) return;
    const res = await fetch(`/api/flows/${selectedFlow.id}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, content: EMPTY_CONTENT[type], is_start: dbNodes.length === 0 }),
    });
    if (res.ok) await fetchNodes(selectedFlow.id);
  };

  const onConnect = useCallback(async (params) => {
    if (!selectedFlow) return;
    const trigger = prompt("Enter the button/list ID that triggers this connection:\n(e.g. browse_products or ask_a_question)");
    if (!trigger) return;
    const res = await fetch(`/api/flows/${selectedFlow.id}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_node_id: params.source,
        trigger: trigger.trim().toLowerCase().replace(/\s/g, "_"),
        to_node_id: params.target,
      }),
    });
    if (res.ok) await fetchNodes(selectedFlow.id);
  }, [selectedFlow]);

  const onEdgeClick = useCallback(async (e, edge) => {
    e.stopPropagation();
    if (!confirm(`Delete connection "${edge.label}"?`)) return;
    await fetch(`/api/flows/edges/${edge.id}`, { method: "DELETE" });
    await fetchNodes(selectedFlow.id);
  }, [selectedFlow]);

  const confirmDeleteNode = async () => {
    await fetch(`/api/flows/nodes/${deleteNodeId}`, { method: "DELETE" });
    setDeleteNodeId(null);
    setDeleteNodeOpen(false);
    await fetchNodes(selectedFlow.id);
  };

  const confirmDeleteFlow = async () => {
    await fetch(`/api/flows/${flowToDelete.id}`, { method: "DELETE" });
    if (selectedFlow?.id === flowToDelete.id) {
      setSelectedFlow(null); setRfNodes([]); setRfEdges([]); setShowFlowList(true);
    }
    setFlowToDelete(null); setDeleteFlowOpen(false);
    await fetchFlows();
  };

  return (
    <div className="space-y-4">
      {showFlowList ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Flows</h2>
            <div className="flex gap-2">
              <Input placeholder="Flow name e.g. Welcome Flow" value={newFlowName}
                onChange={e => setNewFlowName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreateFlow()} />
              <Button onClick={handleCreateFlow} disabled={creatingFlow || !newFlowName.trim()}>
                {creatingFlow ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                Create
              </Button>
            </div>
            {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {!loading && flows.length === 0 && <p className="text-sm text-muted-foreground">No flows yet.</p>}
            <div className="space-y-2">
              {flows.map(flow => (
                <div key={flow.id}
                  className="flex items-center justify-between border rounded px-3 py-2 cursor-pointer hover:border-blue-300 transition-colors"
                  onClick={() => selectFlow(flow)}>
                  <div>
                    <p className="text-sm font-medium">{flow.name}</p>
                    <p className="text-xs text-muted-foreground">Keywords: {(flow.trigger_keywords || []).join(", ")}{flow.free_questions && " · Free questions ON"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${flow.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                      {flow.is_active ? "Active" : "Inactive"}
                    </span>
                    <Button variant="outline" size="sm" onClick={e => toggleActive(flow, e)}>
                      {flow.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setFlowToDelete(flow); setDeleteFlowOpen(true); }}>
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-xl overflow-hidden" style={{ height: "85vh" }}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowFlowList(true); }} className="text-sm text-muted-foreground hover:text-gray-800">← Flows</button>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-semibold">{selectedFlow?.name}</span>
              {selectedFlow?.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Active</span>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleActive(selectedFlow)}>
                {selectedFlow?.is_active ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(s => !s)}>
                <Settings size={13} className="mr-1" /> Settings
              </Button>
            </div>
          </div>

          <div style={{ display: "flex", height: "calc(85vh - 45px)" }}>
            {/* Left sidebar */}
            <div className="w-44 border-r bg-gray-50 p-3 space-y-1.5 shrink-0 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Add node</p>
              {NODE_TYPES_LIST.map(t => (
                <button key={t.value} onClick={() => handleAddNode(t.value)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm text-left">
                  <span>{t.emoji}</span><span>{t.label}</span>
                </button>
              ))}
              <div className="pt-2 border-t mt-2">
                <p className="text-xs text-gray-400 mb-1.5 font-medium">Special IDs</p>
                {RESERVED_IDS.map(r => (
                  <div key={r.id} className="mb-1.5 bg-amber-50 border border-amber-100 rounded p-2">
                    <code className="text-xs font-mono text-blue-600 block">{r.id}</code>
                    <span className="text-xs text-gray-500">{r.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Canvas */}
            <div style={{ flex: 1, background: "#f1f5f9" }}>
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeClick={onEdgeClick}
                nodeTypes={nodeTypes}
                fitView
                panOnScroll panOnScrollMode="free"
                zoomOnPinch zoomOnScroll={false} zoomOnDoubleClick={false}
                panOnDrag={[1, 2]}
                style={{ cursor: "crosshair" }}
              >
                <Background color="#94a3b8" gap={24} size={1.5} variant="dots" />
                <Controls />
                <MiniMap nodeColor={n => NODE_COLORS[n.data?.type]?.border || "#ccc"} />
                {rfNodes.length === 0 && (
                  <Panel position="top-center">
                    <div className="bg-white border rounded-lg px-4 py-3 text-sm text-muted-foreground shadow-sm mt-4">
                      👈 Click a node type on the left to start building
                    </div>
                  </Panel>
                )}
              </ReactFlow>
            </div>
          </div>

          {/* Settings modal */}
          {settingsOpen && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 m-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Flow settings</h3>
                  <button onClick={() => setSettingsOpen(false)}><X size={16} /></button>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Trigger keywords (comma separated)</p>
                  <Input value={editKeywords} onChange={e => setEditKeywords(e.target.value)} placeholder="hi, hello, hey, start, menu" />
                  <p className="text-xs text-muted-foreground">User sends any of these → flow starts</p>
                </div>
                <div className="flex items-start gap-3">
                  <input type="checkbox" id="fq" checked={editFreeQ} onChange={e => setEditFreeQ(e.target.checked)} className="mt-0.5" />
                  <div>
                    <label htmlFor="fq" className="text-sm font-medium cursor-pointer">Allow free questions</label>
                    <p className="text-xs text-muted-foreground mt-0.5">When ON — typed messages get AI answers even while in a buttons node</p>
                  </div>
                </div>
                <Button onClick={handleSaveSettings} disabled={savingSettings} className="w-full">
                  {savingSettings ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                  Save settings
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <AppAlertDialog open={deleteFlowOpen} title="Delete flow?"
        description={<>Flow <strong>{flowToDelete?.name}</strong> and all its nodes will be permanently deleted.</>}
        confirmText="Delete" cancelText="Cancel"
        onConfirm={confirmDeleteFlow}
        onCancel={() => { setDeleteFlowOpen(false); setFlowToDelete(null); }} />
      <AppAlertDialog open={deleteNodeOpen} title="Delete node?"
        description="This node and all its connections will be permanently deleted."
        confirmText="Delete" cancelText="Cancel"
        onConfirm={confirmDeleteNode}
        onCancel={() => { setDeleteNodeOpen(false); setDeleteNodeId(null); }} />
    </div>
  );
}