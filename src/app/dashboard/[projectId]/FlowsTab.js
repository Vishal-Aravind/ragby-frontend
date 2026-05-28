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
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, X, ChevronDown, Settings } from "lucide-react";
import AppAlertDialog from "@/components/alertdialog";

// ── Node type definitions ─────────────────────────────────
const NODE_TYPES = [
  { value: "message",          label: "Message",           emoji: "💬" },
  { value: "message_buttons",  label: "Message + Buttons", emoji: "🔘" },
  { value: "message_list",     label: "Message + List",    emoji: "📋" },
  { value: "message_media",    label: "Message + Media",   emoji: "🖼️" },
  { value: "message_video",    label: "Message + Video",   emoji: "🎥" },
];

const NODE_COLORS = {
  message:         { bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#dcfce7" },
  message_buttons: { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", badge: "#dbeafe" },
  message_list:    { bg: "#faf5ff", border: "#c4b5fd", text: "#5b21b6", badge: "#ede9fe" },
  message_media:   { bg: "#fff7ed", border: "#fdba74", text: "#9a3412", badge: "#ffedd5" },
  message_video:   { bg: "#fdf4ff", border: "#e879f9", text: "#86198f", badge: "#fae8ff" },
  ask_a_question:  { bg: "#fffbeb", border: "#fcd34d", text: "#78350f", badge: "#fef3c7" },
  back_to_menu:    { bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#dcfce7" },
  talk_to_human:   { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", badge: "#fee2e2" },
};

// Auto-generate ID from label
const toId = (label) =>
  label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `btn_${Date.now()}`;

const EMPTY_CONTENT = {
  message:         { body: "" },
  message_buttons: { body: "", buttons: [{ label: "Option 1" }, { label: "Option 2" }] },
  message_list:    { body: "", button_text: "View Options", sections: [{ title: "", rows: [{ label: "Option 1" }, { label: "Option 2" }] }] },
  message_media:   { body: "", media_url: "" },
  message_video:   { body: "", video_url: "" },
  ask_a_question:  { body: "You can now ask me anything about our products and services!" },
  back_to_menu:    { body: "" }, // no message needed — just restarts flow
  talk_to_human:   { body: "Connecting you to our team. Please wait..." },
};

// Special nodes — pre-configured, drag onto canvas
const SPECIAL_NODES = [
  {
    type: "ask_a_question",
    label: "Ask a Question",
    emoji: "🤖",
    desc: "User enters AI mode",
    color: { bg: "#fffbeb", border: "#fcd34d", text: "#78350f", badge: "#fef3c7" },
  },
  {
    type: "back_to_menu",
    label: "Back to Menu",
    emoji: "↩️",
    desc: "Restarts flow",
    color: { bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#dcfce7" },
  },
  {
    type: "talk_to_human",
    label: "Talk to Human",
    emoji: "👤",
    desc: "Human handoff",
    color: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", badge: "#fee2e2" },
  },
];

// ─────────────────────────────────────────────────────────
// CUSTOM NODE COMPONENT
// ─────────────────────────────────────────────────────────
function FlowNode({ id, data, selected }) {
  const [type, setType]         = useState(data.type || "message");
  const [content, setContent]   = useState(data.content || {});
  const [isStart, setIsStart]   = useState(data.isStart || false);
  const [expanded, setExpanded] = useState(false);
  const [showTypeDD, setShowTypeDD] = useState(false);
  const [saving, setSaving]     = useState(false);
  const typeRef = useRef(null);

  useEffect(() => {
    setType(data.type || "message");
    setContent(data.content || {});
    setIsStart(data.isStart || false);
  }, [data.type, data.content, data.isStart]);

  useEffect(() => {
    const handler = (e) => { if (typeRef.current && !typeRef.current.contains(e.target)) setShowTypeDD(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const colors = NODE_COLORS[type] || NODE_COLORS.message;
  const isSpecial = ["ask_a_question", "back_to_menu", "talk_to_human"].includes(type);
  const specialNode = SPECIAL_NODES.find(s => s.type === type);
  const typeLabel = specialNode?.label || NODE_TYPES.find(t => t.value === type)?.label || "Message";
  const typeEmoji = specialNode?.emoji || NODE_TYPES.find(t => t.value === type)?.emoji || "💬";

  const updateContent = (key, val) => setContent(prev => ({ ...prev, [key]: val }));

  const updateButtonLabel = (idx, val) => {
    const btns = [...(content.buttons || [])];
    btns[idx] = { ...btns[idx], label: val };
    updateContent("buttons", btns);
  };

  const addButton = () => {
    if ((content.buttons || []).length >= 3) return;
    updateContent("buttons", [...(content.buttons || []), { label: `Option ${(content.buttons || []).length + 1}` }]);
  };

  const removeButton = (idx) => {
    const btns = [...(content.buttons || [])];
    btns.splice(idx, 1);
    updateContent("buttons", btns);
  };

  const updateRowLabel = (sIdx, rIdx, val) => {
    const sections = JSON.parse(JSON.stringify(content.sections || []));
    sections[sIdx].rows[rIdx].label = val;
    updateContent("sections", sections);
  };

  const addRow = (sIdx) => {
    const sections = JSON.parse(JSON.stringify(content.sections || []));
    sections[sIdx].rows.push({ label: `Option ${sections[sIdx].rows.length + 1}` });
    updateContent("sections", sections);
  };

  const removeRow = (sIdx, rIdx) => {
    const sections = JSON.parse(JSON.stringify(content.sections || []));
    sections[sIdx].rows.splice(rIdx, 1);
    updateContent("sections", sections);
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    setContent(EMPTY_CONTENT[newType]);
    setShowTypeDD(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // Build content with auto-IDs for buttons/list
    let finalContent = { ...content };
    if (type === "message_buttons") {
      finalContent.buttons = (content.buttons || []).map(btn => ({
        ...btn,
        id: toId(btn.label),
      }));
    }
    if (type === "message_list") {
      finalContent.sections = (content.sections || []).map(section => ({
        ...section,
        rows: (section.rows || []).map(row => ({
          ...row,
          id: toId(row.label),
        })),
      }));
    }
    await data.onSave(id, { type, content: finalContent, is_start: isStart });
    setSaving(false);
    setExpanded(false);
  };

  // Buttons for rendering handles
  const buttons = type === "message_buttons" ? (content.buttons || []) : [];
  const listRows = type === "message_list"
    ? (content.sections || []).flatMap(s => s.rows || [])
    : [];
  const handleItems = type === "message_buttons" ? buttons : type === "message_list" ? listRows : [];
  const hasHandles = handleItems.length > 0;

  return (
    <div
      style={{
        background: colors.bg,
        border: `2px solid ${selected ? "#3b82f6" : colors.border}`,
        borderRadius: 12,
        minWidth: 200,
        maxWidth: expanded ? 300 : 230,
        boxShadow: selected ? "0 0 0 3px rgba(59,130,246,0.2)" : "0 2px 8px rgba(0,0,0,0.08)",
        transition: "all 0.15s",
        position: "relative",
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Target handle — top center */}
      <Handle type="target" position={Position.Top}
        style={{ background: colors.border, width: 10, height: 10, top: -6, left: "50%" }}
      />

      {/* ── Node header ── */}
      <div style={{ padding: "8px 10px", cursor: "pointer" }} className="drag-handle"
        onClick={() => setExpanded(e => !e)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>

          {/* Type dropdown trigger — disabled for special nodes */}
          <div ref={typeRef} style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => !isSpecial && setShowTypeDD(p => !p)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 600, padding: "2px 8px",
                borderRadius: 20, background: colors.badge, color: colors.text,
                border: "none", cursor: isSpecial ? "default" : "pointer",
              }}
            >
              {typeEmoji} {typeLabel} {!isSpecial && <ChevronDown size={10} />}
            </button>

            {showTypeDD && (
              <div style={{
                position: "absolute", zIndex: 9999, top: "100%", left: 0, marginTop: 4,
                background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: 4, minWidth: 180,
              }}>
                {NODE_TYPES.map(t => (
                  <button key={t.value} onClick={() => handleTypeChange(t.value)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "6px 10px", border: "none",
                      background: type === t.value ? colors.badge : "none",
                      borderRadius: 6, cursor: "pointer", fontSize: 13,
                      color: type === t.value ? colors.text : "#374151",
                      fontWeight: type === t.value ? 600 : 400,
                    }}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {isStart && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 6px",
                borderRadius: 20, background: "#fef3c7", color: "#92400e",
              }}>START</span>
            )}
            <button
              onClick={e => { e.stopPropagation(); data.onDelete(id); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#fca5a5", padding: 2, lineHeight: 1 }}
            >✕</button>
          </div>
        </div>

        {/* Message preview */}
        <p style={{
          fontSize: 12, color: "#374151", margin: "6px 0 0",
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          lineHeight: 1.4,
        }}>
          {content.body || <span style={{ color: "#9ca3af" }}>Click to edit...</span>}
        </p>

        {/* Button/list previews with handles */}
        {type === "message_buttons" && (content.buttons || []).length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {(content.buttons || []).map((btn, idx) => (
              <div key={idx} style={{ position: "relative" }}>
                <div style={{
                  fontSize: 11, padding: "3px 28px 3px 8px",
                  background: "white", border: `1px solid ${colors.border}`,
                  borderRadius: 6, color: colors.text, fontWeight: 500,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {btn.label || `Button ${idx + 1}`}
                </div>
                {/* Source handle for this button */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={toId(btn.label || `btn_${idx}`)}
                  style={{
                    background: colors.border, width: 10, height: 10,
                    right: -5, top: "50%", transform: "translateY(-50%)",
                    border: "2px solid white",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {type === "message_list" && (content.sections || []).flatMap(s => s.rows || []).length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {(content.sections || []).flatMap(s => s.rows || []).map((row, idx) => (
              <div key={idx} style={{ position: "relative" }}>
                <div style={{
                  fontSize: 11, padding: "3px 28px 3px 8px",
                  background: "white", border: `1px solid ${colors.border}`,
                  borderRadius: 6, color: colors.text, fontWeight: 500,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {row.label || `Row ${idx + 1}`}
                </div>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={toId(row.label || `row_${idx}`)}
                  style={{
                    background: colors.border, width: 10, height: 10,
                    right: -5, top: "50%", transform: "translateY(-50%)",
                    border: "2px solid white",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Single source handle for non-button types */}
        {type !== "message_buttons" && type !== "message_list" && (
          <Handle type="source" position={Position.Bottom}
            style={{ background: colors.border, width: 10, height: 10, bottom: -6 }}
          />
        )}
      </div>

      {/* ── Expanded editor ── */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${colors.border}`, padding: "10px 10px" }}
          onClick={e => e.stopPropagation()}>

          {/* Start node toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, cursor: "pointer", fontSize: 12, color: "#374151" }}>
            <input type="checkbox" checked={isStart} onChange={e => setIsStart(e.target.checked)} />
            Set as start node
          </label>

          {/* ── Special node info ── */}
          {isSpecial && (
            <div style={{ marginTop: 6 }}>
              <p style={{ fontSize: 11, color: colors.text, background: colors.badge, borderRadius: 6, padding: "4px 8px" }}>
                {specialNode?.desc}
              </p>
            </div>
          )}

          {/* Message body — hidden for back_to_menu */}
          {type !== "back_to_menu" && (
            <textarea
              style={{
                width: "100%", border: "1px solid #e2e8f0", borderRadius: 6,
                padding: "6px 8px", fontSize: 12, resize: "none", outline: "none",
                fontFamily: "inherit", boxSizing: "border-box",
              }}
              rows={3}
              value={content.body || ""}
              onChange={e => updateContent("body", e.target.value)}
              placeholder="Type your message..."
              onClick={e => e.stopPropagation()}
            />
          )}

          {/* Buttons editor */}
          {type === "message_buttons" && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Buttons (max 3)</p>
              {(content.buttons || []).map((btn, idx) => (
                <div key={idx} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                  <input
                    style={{
                      flex: 1, border: "1px solid #e2e8f0", borderRadius: 6,
                      padding: "4px 8px", fontSize: 12, outline: "none",
                    }}
                    placeholder={`Button ${idx + 1}`}
                    value={btn.label || ""}
                    onChange={e => updateButtonLabel(idx, e.target.value)}
                    onClick={e => e.stopPropagation()}
                  />
                  <button onClick={() => removeButton(idx)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", fontSize: 14, lineHeight: 1 }}>✕</button>
                </div>
              ))}
              {(content.buttons || []).length < 3 && (
                <button onClick={addButton}
                  style={{
                    width: "100%", border: "1px dashed #cbd5e1", borderRadius: 6,
                    padding: "4px", fontSize: 12, background: "none", cursor: "pointer", color: "#64748b",
                  }}>
                  + Add button
                </button>
              )}
              <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>
                💡 Drag from the → handle on each button to connect to next node
              </p>
            </div>
          )}

          {/* List editor */}
          {type === "message_list" && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Button text</p>
              <input
                style={{
                  width: "100%", border: "1px solid #e2e8f0", borderRadius: 6,
                  padding: "4px 8px", fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 8,
                }}
                placeholder="View Options"
                value={content.button_text || ""}
                onChange={e => updateContent("button_text", e.target.value)}
                onClick={e => e.stopPropagation()}
              />
              {(content.sections || []).map((section, sIdx) => (
                <div key={sIdx}>
                  <input
                    style={{
                      width: "100%", border: "1px solid #e2e8f0", borderRadius: 6,
                      padding: "4px 8px", fontSize: 12, outline: "none",
                      boxSizing: "border-box", marginBottom: 6,
                    }}
                    placeholder="Section title (optional)"
                    value={section.title || ""}
                    onChange={e => {
                      const s = JSON.parse(JSON.stringify(content.sections));
                      s[sIdx].title = e.target.value;
                      updateContent("sections", s);
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                  {(section.rows || []).map((row, rIdx) => (
                    <div key={rIdx} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                      <input
                        style={{
                          flex: 1, border: "1px solid #e2e8f0", borderRadius: 6,
                          padding: "4px 8px", fontSize: 12, outline: "none",
                        }}
                        placeholder={`Row ${rIdx + 1}`}
                        value={row.label || ""}
                        onChange={e => updateRowLabel(sIdx, rIdx, e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                      <button onClick={() => removeRow(sIdx, rIdx)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", fontSize: 14, lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => addRow(sIdx)}
                    style={{
                      width: "100%", border: "1px dashed #cbd5e1", borderRadius: 6,
                      padding: "4px", fontSize: 12, background: "none", cursor: "pointer", color: "#64748b", marginBottom: 4,
                    }}>
                    + Add row
                  </button>
                </div>
              ))}
              <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                💡 Drag from the → handle on each row to connect to next node
              </p>
            </div>
          )}

          {/* Media */}
          {type === "message_media" && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Image URL</p>
              <input
                style={{
                  width: "100%", border: "1px solid #e2e8f0", borderRadius: 6,
                  padding: "4px 8px", fontSize: 12, outline: "none", boxSizing: "border-box",
                  fontFamily: "monospace",
                }}
                placeholder="https://example.com/image.jpg"
                value={content.media_url || ""}
                onChange={e => updateContent("media_url", e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          {/* Video */}
          {type === "message_video" && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Video URL</p>
              <input
                style={{
                  width: "100%", border: "1px solid #e2e8f0", borderRadius: 6,
                  padding: "4px 8px", fontSize: 12, outline: "none", boxSizing: "border-box",
                  fontFamily: "monospace",
                }}
                placeholder="https://example.com/video.mp4"
                value={content.video_url || ""}
                onChange={e => updateContent("video_url", e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          {/* Save */}
          <button onClick={handleSave} disabled={saving}
            style={{
              marginTop: 10, width: "100%", background: "#1e40af", color: "white",
              border: "none", borderRadius: 6, padding: "6px", fontSize: 12,
              fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}>
            {saving ? "Saving..." : "✓ Save"}
          </button>
        </div>
      )}
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

  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

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
      position: { x: 120 + (i % 3) * 320, y: Math.floor(i / 3) * 220 + 60 },
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
      sourceHandle: e.trigger,
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

  const handleAddNode = async (type = "message", position = null) => {
    if (!selectedFlow) return;
    const pos = position || { x: 200 + rfNodes.length * 50, y: 100 + rfNodes.length * 30 };

    // Save to server first, get real ID
    const res = await fetch(`/api/flows/${selectedFlow.id}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        content: EMPTY_CONTENT[type],
        is_start: dbNodes.length === 0,
      }),
    });

    if (!res.ok) return;
    const node = await res.json();

    // Add to canvas immediately with real ID and callbacks
    setDbNodes(prev => [...prev, node]);
    setRfNodes(nds => [...nds, {
      id: node.id,
      type: "flowNode",
      position: pos,
      dragHandle: ".drag-handle",
      data: {
        type: node.type,
        content: node.content,
        isStart: node.is_start,
        onSave: async (nodeId, updates) => {
          await fetch(`/api/flows/nodes/${nodeId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });
          await fetchNodes(selectedFlow.id);
        },
        onDelete: (nodeId) => {
          setDeleteNodeId(nodeId);
          setDeleteNodeOpen(true);
        },
      },
    }]);
  };

  const onConnect = useCallback(async (params) => {
    if (!selectedFlow) return;
    const trigger = params.sourceHandle || "next";

    // Add edge to UI immediately — no delay
    const tempId = `temp_${Date.now()}`;
    setRfEdges(eds => [...eds, {
      id: tempId,
      source: params.source,
      target: params.target,
      sourceHandle: trigger,
      label: trigger,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
      style: { stroke: "#94a3b8", strokeWidth: 2 },
      labelStyle: { fontSize: 11, fill: "#64748b" },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
    }]);

    // Save to server in background
    const res = await fetch(`/api/flows/${selectedFlow.id}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_node_id: params.source,
        trigger,
        to_node_id: params.target,
      }),
    });

    // Replace temp edge with real one from server
    if (res.ok) await fetchNodes(selectedFlow.id);
  }, [selectedFlow]);

  const onEdgeClick = useCallback(async (e, edge) => {
    e.stopPropagation();
    if (!confirm(`Delete connection "${edge.label}"?`)) return;
    // Remove from UI immediately
    setRfEdges(eds => eds.filter(ed => ed.id !== edge.id));
    // Delete from server in background
    await fetch(`/api/flows/edges/${edge.id}`, { method: "DELETE" });
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
                    <p className="text-xs text-muted-foreground">
                      Keywords: {(flow.trigger_keywords || []).join(", ")}
                      {flow.free_questions && " · Free questions ON"}
                    </p>
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
              <button onClick={() => setShowFlowList(true)} className="text-sm text-muted-foreground hover:text-gray-800">
                ← Flows
              </button>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-semibold">{selectedFlow?.name}</span>
              {selectedFlow?.is_active && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Active</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleAddNode("message")}>
                <Plus size={13} className="mr-1" /> Add node
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleActive(selectedFlow)}>
                {selectedFlow?.is_active ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(s => !s)}>
                <Settings size={13} className="mr-1" /> Settings
              </Button>
            </div>
          </div>

          {/* Body: sidebar + canvas */}
          <div style={{ display: "flex", height: "calc(85vh - 45px)" }}>

            {/* Left panel — special nodes */}
            <div style={{
              width: 160, borderRight: "1px solid #e2e8f0",
              background: "#fafafa", padding: "12px 10px",
              display: "flex", flexDirection: "column", gap: 6, overflowY: "auto",
              shrink: 0,
            }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                Special nodes
              </p>
              {SPECIAL_NODES.map(sn => (
                <div
                  key={sn.type}
                  draggable
                  onDragStart={e => e.dataTransfer.setData("nodeType", sn.type)}
                  style={{
                    background: sn.color.bg,
                    border: `1.5px solid ${sn.color.border}`,
                    borderRadius: 8, padding: "8px 10px",
                    cursor: "grab", userSelect: "none",
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 600, color: sn.color.text, margin: 0 }}>
                    {sn.emoji} {sn.label}
                  </p>
                  <p style={{ fontSize: 10, color: "#94a3b8", margin: "2px 0 0" }}>{sn.desc}</p>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 6, paddingTop: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  Tip
                </p>
                <p style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>
                  Drag special nodes onto the canvas. Connect button/list handles → to any node.
                </p>
              </div>
            </div>

          {/* Canvas */}
          <div
            ref={reactFlowWrapper}
            style={{ flex: 1, background: "#f1f5f9" }}
            onDragOver={e => e.preventDefault()}
            onDrop={async e => {
              e.preventDefault();
              const type = e.dataTransfer.getData("nodeType");
              if (!type || !selectedFlow || !reactFlowInstance) return;

              const position = reactFlowInstance.screenToFlowPosition({
                x: e.clientX,
                y: e.clientY,
              });

              await handleAddNode(type, position);
            }}
          >
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgeClick={onEdgeClick}
              onInit={setReactFlowInstance}
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
                    Click <strong>+ Add node</strong> in the top bar to start building your flow
                  </div>
                </Panel>
              )}
            </ReactFlow>
          </div>
          </div> {/* end sidebar+canvas */}

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