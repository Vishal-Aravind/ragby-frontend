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
import { Loader2, Plus, Trash2, X, ChevronDown, Settings, Save, AlertCircle } from "lucide-react";
import AppAlertDialog from "@/components/alertdialog";

const NODE_TYPES = [
  { value: "message",         label: "Message",           emoji: "💬" },
  { value: "message_buttons", label: "Message + Buttons", emoji: "🔘" },
  { value: "message_list",    label: "Message + List",    emoji: "📋" },
  { value: "message_media",   label: "Message + Media",   emoji: "🖼️" },
  { value: "message_video",    label: "Message + Video",    emoji: "🎥" },
  { value: "message_document", label: "Message + Document", emoji: "📄" },
];

const NODE_COLORS = {
  message:         { bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#dcfce7" },
  message_buttons: { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af", badge: "#dbeafe" },
  message_list:    { bg: "#faf5ff", border: "#c4b5fd", text: "#5b21b6", badge: "#ede9fe" },
  message_media:   { bg: "#fff7ed", border: "#fdba74", text: "#9a3412", badge: "#ffedd5" },
  message_video:   { bg: "#fdf4ff", border: "#e879f9", text: "#86198f", badge: "#fae8ff" },
  ask_a_question:  { bg: "#fffbeb", border: "#fcd34d", text: "#78350f", badge: "#fef3c7" },
  back_to_menu:    { bg: "#f0fdf4", border: "#86efac", text: "#166534", badge: "#dcfce7" },
  talk_to_human:    { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", badge: "#fee2e2" },
  message_document: { bg: "#f0f9ff", border: "#7dd3fc", text: "#0c4a6e", badge: "#e0f2fe" },
};

const NODE_LABELS = {
  message: "Message", message_buttons: "Buttons", message_list: "List",
  message_media: "Media", message_video: "Video",
  ask_a_question: "Ask AI", back_to_menu: "Back to Menu", talk_to_human: "Handoff",
};

const toId = (label) =>
  (label || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `id_${Date.now()}`;

const EMPTY_CONTENT = {
  message:         { body: "" },
  message_buttons: { body: "", buttons: [{ label: "Option 1" }, { label: "Option 2" }] },
  message_list:    { body: "", button_text: "View Options", sections: [{ title: "", rows: [{ label: "Option 1" }, { label: "Option 2" }] }] },
  message_media:   { body: "", media_url: "" },
  message_video:    { body: "", video_url: "" },
  message_document: { body: "", document_url: "", filename: "" },
  ask_a_question:  { body: "You can now ask me anything!" },
  back_to_menu:    { body: "" },
  talk_to_human:   { body: "Connecting you to our team. Please wait..." },
};

const SPECIAL_NODES = [
  { type: "ask_a_question", label: "Ask a Question", emoji: "🤖", desc: "User enters AI mode" },
  { type: "back_to_menu",   label: "Back to Menu",   emoji: "↩️", desc: "Restarts flow" },
  { type: "talk_to_human",  label: "Talk to Human",  emoji: "👤", desc: "Human handoff" },
];

// ─────────────────────────────────────────────────────────
// FLOW NODE — all changes are local, no API on edit
// ─────────────────────────────────────────────────────────
function FlowNode({ id, data, selected }) {
  const [expanded, setExpanded]     = useState(false);
  const [showTypeDD, setShowTypeDD] = useState(false);
  const typeRef = useRef(null);

  // Local state mirrors data — changes go up via data.onChange
  const type    = data.type    || "message";
  const content = data.content || {};
  const isStart = data.isStart || false;

  const isSpecial = ["ask_a_question", "back_to_menu", "talk_to_human"].includes(type);
  const special   = SPECIAL_NODES.find(s => s.type === type);
  const colors    = NODE_COLORS[type] || NODE_COLORS.message;
  const label     = special?.label || NODE_TYPES.find(t => t.value === type)?.label || "Message";
  const emoji     = special?.emoji || NODE_TYPES.find(t => t.value === type)?.emoji || "💬";

  useEffect(() => {
    const h = (e) => { if (typeRef.current && !typeRef.current.contains(e.target)) setShowTypeDD(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const update = (patch) => data.onChange(id, patch);
  const updateContent = (key, val) => update({ content: { ...content, [key]: val } });

  const updateButtonLabel = (idx, val) => {
    const btns = [...(content.buttons || [])];
    btns[idx] = { ...btns[idx], label: val };
    updateContent("buttons", btns);
  };
  const addButton = () => {
    if ((content.buttons || []).length >= 3) return;
    updateContent("buttons", [...(content.buttons || []), { label: `Option ${(content.buttons||[]).length+1}` }]);
  };
  const removeButton = (idx) => {
    const b = [...(content.buttons||[])]; b.splice(idx,1); updateContent("buttons", b);
  };
  const updateRowLabel = (sIdx, rIdx, val) => {
    const s = JSON.parse(JSON.stringify(content.sections||[]));
    s[sIdx].rows[rIdx].label = val; updateContent("sections", s);
  };
  const addRow = (sIdx) => {
    const s = JSON.parse(JSON.stringify(content.sections||[]));
    s[sIdx].rows.push({ label: `Option ${s[sIdx].rows.length+1}` }); updateContent("sections", s);
  };
  const removeRow = (sIdx, rIdx) => {
    const s = JSON.parse(JSON.stringify(content.sections||[]));
    s[sIdx].rows.splice(rIdx,1); updateContent("sections", s);
  };

  return (
    <div
      style={{
        background: colors.bg,
        border: `2px solid ${selected ? "#3b82f6" : colors.border}`,
        borderRadius: 12, minWidth: 200, maxWidth: expanded ? 300 : 240,
        boxShadow: selected ? "0 0 0 3px rgba(59,130,246,0.2)" : "0 2px 8px rgba(0,0,0,0.08)",
        transition: "all 0.15s", position: "relative",
      }}
      onClick={e => e.stopPropagation()}
    >
      <Handle type="target" position={Position.Left}
        style={{ background: colors.border, width: 10, height: 10, left: -6 }} />

      {/* Header */}
      <div style={{ padding: "8px 10px", cursor: "pointer" }} className="drag-handle"
        onClick={() => setExpanded(e => !e)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>

          {/* Type badge */}
          <div ref={typeRef} style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => !isSpecial && setShowTypeDD(p => !p)}
              style={{
                display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                padding: "2px 8px", borderRadius: 20, background: colors.badge, color: colors.text,
                border: "none", cursor: isSpecial ? "default" : "pointer",
              }}>
              {emoji} {label} {!isSpecial && <ChevronDown size={10} />}
            </button>
            {showTypeDD && (
              <div style={{
                position: "absolute", zIndex: 9999, top: "100%", left: 0, marginTop: 4,
                background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: 4, minWidth: 180,
              }}>
                {NODE_TYPES.map(t => (
                  <button key={t.value}
                    onClick={() => { update({ type: t.value, content: EMPTY_CONTENT[t.value] }); setShowTypeDD(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%",
                      padding: "6px 10px", border: "none",
                      background: type === t.value ? colors.badge : "none",
                      borderRadius: 6, cursor: "pointer", fontSize: 13,
                      color: type === t.value ? colors.text : "#374151",
                      fontWeight: type === t.value ? 600 : 400,
                    }}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {isStart && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 20, background: "#fef3c7", color: "#92400e" }}>
                START
              </span>
            )}
            <button onClick={e => { e.stopPropagation(); data.onDelete(id); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#fca5a5", padding: 2, lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* Preview */}
        <p style={{
          fontSize: 12, color: content.body ? "#374151" : "#9ca3af", margin: "6px 0 0",
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.4,
        }}>
          {content.body || (isSpecial ? special?.desc : "Click to edit...")}
        </p>

        {/* Button pills + handles */}
        {type === "message_buttons" && (content.buttons||[]).length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {(content.buttons||[]).map((btn, idx) => (
              <div key={idx} style={{ position: "relative" }}>
                <div style={{
                  fontSize: 11, padding: "3px 22px 3px 8px", background: "white",
                  border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.text,
                  fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {btn.label || `Button ${idx+1}`}
                </div>
                <Handle type="source" position={Position.Right}
                  id={toId(btn.label || `btn_${idx}`)}
                  style={{ background: colors.border, width: 10, height: 10, right: -5, top: "50%", transform: "translateY(-50%)", border: "2px solid white" }} />
              </div>
            ))}
          </div>
        )}

        {type === "message_list" && (content.sections||[]).flatMap(s=>s.rows||[]).length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {(content.sections||[]).flatMap(s=>s.rows||[]).map((row, idx) => (
              <div key={idx} style={{ position: "relative" }}>
                <div style={{
                  fontSize: 11, padding: "3px 22px 3px 8px", background: "white",
                  border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.text,
                  fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {row.label || `Row ${idx+1}`}
                </div>
                <Handle type="source" position={Position.Right}
                  id={toId(row.label || `row_${idx}`)}
                  style={{ background: colors.border, width: 10, height: 10, right: -5, top: "50%", transform: "translateY(-50%)", border: "2px solid white" }} />
              </div>
            ))}
          </div>
        )}

        {type !== "message_buttons" && type !== "message_list" && (
          <Handle type="source" position={Position.Right}
            style={{ background: colors.border, width: 10, height: 10, right: -6 }} />
        )}
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${colors.border}`, padding: "10px" }}
          onClick={e => e.stopPropagation()}>

          <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, cursor: "pointer", fontSize: 12, color: "#374151" }}>
            <input type="checkbox" checked={isStart}
              onChange={e => {
                // Unset all other start nodes via onSetStart
                data.onSetStart(id, e.target.checked);
              }} />
            Set as start node
          </label>

          {isSpecial && (
            <p style={{ fontSize: 11, color: colors.text, background: colors.badge, borderRadius: 6, padding: "4px 8px", marginBottom: 8 }}>
              {special?.desc}
            </p>
          )}

          {type !== "back_to_menu" && (
            <>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Message</p>
              <textarea
                style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 8px", fontSize: 12, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                rows={3} value={content.body || ""}
                onChange={e => updateContent("body", e.target.value)}
                placeholder="Type your message..."
                onClick={e => e.stopPropagation()} />
            </>
          )}

          {type === "message_buttons" && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Buttons (max 3)</p>
              {(content.buttons||[]).map((btn, idx) => (
                <div key={idx} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                  <input style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none" }}
                    placeholder={`Button ${idx+1}`} value={btn.label||""}
                    onChange={e => updateButtonLabel(idx, e.target.value)}
                    onClick={e => e.stopPropagation()} />
                  <button onClick={() => removeButton(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", fontSize: 14, lineHeight: 1 }}>✕</button>
                </div>
              ))}
              {(content.buttons||[]).length < 3 && (
                <button onClick={addButton} style={{ width: "100%", border: "1px dashed #cbd5e1", borderRadius: 6, padding: "4px", fontSize: 12, background: "none", cursor: "pointer", color: "#64748b" }}>
                  + Add button
                </button>
              )}
              <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 6 }}>💡 Drag → handle on each button to connect</p>
            </div>
          )}

          {type === "message_list" && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Button text</p>
              <input style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
                placeholder="View Options" value={content.button_text||""}
                onChange={e => updateContent("button_text", e.target.value)}
                onClick={e => e.stopPropagation()} />
              {(content.sections||[]).map((section, sIdx) => (
                <div key={sIdx}>
                  <input style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: 6 }}
                    placeholder="Section title (optional)" value={section.title||""}
                    onChange={e => { const s=JSON.parse(JSON.stringify(content.sections)); s[sIdx].title=e.target.value; updateContent("sections",s); }}
                    onClick={e => e.stopPropagation()} />
                  {(section.rows||[]).map((row, rIdx) => (
                    <div key={rIdx} style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                      <input style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none" }}
                        placeholder={`Row ${rIdx+1}`} value={row.label||""}
                        onChange={e => updateRowLabel(sIdx, rIdx, e.target.value)}
                        onClick={e => e.stopPropagation()} />
                      <button onClick={() => removeRow(sIdx, rIdx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#f87171", fontSize: 14, lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                  <button onClick={() => addRow(sIdx)} style={{ width: "100%", border: "1px dashed #cbd5e1", borderRadius: 6, padding: "4px", fontSize: 12, background: "none", cursor: "pointer", color: "#64748b", marginBottom: 4 }}>
                    + Add row
                  </button>
                </div>
              ))}
              <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>💡 Drag → handle on each row to connect</p>
            </div>
          )}

          {type === "message_media" && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Image URL</p>
              <input style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                placeholder="https://example.com/image.jpg" value={content.media_url||""}
                onChange={e => updateContent("media_url", e.target.value)}
                onClick={e => e.stopPropagation()} />
            </div>
          )}

          {type === "message_video" && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Video URL</p>
              <input style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                placeholder="https://example.com/video.mp4" value={content.video_url||""}
                onChange={e => updateContent("video_url", e.target.value)}
                onClick={e => e.stopPropagation()} />
            </div>
          )}

          {type === "message_document" && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <div>
                <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Document URL</p>
                <input style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                  placeholder="https://example.com/file.pdf" value={content.document_url||""}
                  onChange={e => updateContent("document_url", e.target.value)}
                  onClick={e => e.stopPropagation()} />
              </div>
              <div>
                <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Filename (shown to user)</p>
                <input style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                  placeholder="e.g. product_catalog.pdf" value={content.filename||""}
                  onChange={e => updateContent("filename", e.target.value)}
                  onClick={e => e.stopPropagation()} />
              </div>
              <p style={{ fontSize: 10, color: "#94a3b8" }}>Supports PDF, Word, Excel, PPT, CSV and more</p>
            </div>
          )}
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

  // Save state
  const [saveStatus, setSaveStatus] = useState("saved"); // "saved" | "unsaved" | "saving"
  const autoSaveTimer = useRef(null);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Refs for save function to access latest state
  const rfNodesRef = useRef([]);
  const rfEdgesRef = useRef([]);
  const selectedFlowRef = useRef(null);

  useEffect(() => { rfNodesRef.current = rfNodes; }, [rfNodes]);
  useEffect(() => { rfEdgesRef.current = rfEdges; }, [rfEdges]);
  useEffect(() => { selectedFlowRef.current = selectedFlow; }, [selectedFlow]);

  const fetchFlows = async () => {
    setLoading(true);
    const res = await fetch(`/api/flows?project_id=${projectId}`);
    if (res.ok) setFlows((await res.json()) || []);
    setLoading(false);
  };

  useEffect(() => { fetchFlows(); }, [projectId]);

  // ── Mark dirty and schedule auto-save ────────────────
  const markDirty = useCallback(() => {
    setSaveStatus("unsaved");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      doSave();
    }, 30000);
  }, []);

  // ── Core save function ────────────────────────────────
  const doSave = useCallback(async () => {
    const flow = selectedFlowRef.current;
    if (!flow) return;
    const nodes = rfNodesRef.current;
    const edges = rfEdgesRef.current;

    setSaveStatus("saving");

    const payload = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.data.type,
        content: n.data.content,
        is_start: n.data.isStart,
        position: n.position,
      })),
      edges: edges.map(e => ({
        from_node_id: e.source,
        trigger: e.sourceHandle || "next",
        to_node_id: e.target,
      })),
    };

    const res = await fetch(`/api/flows/${flow.id}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const result = await res.json();
      // Remap node IDs if server returned new ones
      if (result.idMap) {
        setRfNodes(nds => nds.map(n => ({
          ...n,
          id: result.idMap[n.id] || n.id,
        })));
        setRfEdges(eds => eds.map(e => ({
          ...e,
          source: result.idMap[e.source] || e.source,
          target: result.idMap[e.target] || e.target,
        })));
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("saved"), 2000);
    } else {
      setSaveStatus("unsaved");
    }
  }, []);

  // ── Load flow nodes from server ───────────────────────
  const loadFlow = async (flow) => {
    const res = await fetch(`/api/flows/${flow.id}/nodes`);
    if (!res.ok) return;
    const data = await res.json();
    buildGraph(data.nodes || [], data.edges || []);
    setSaveStatus("saved");
  };

  const buildGraph = (nodes, edges) => {
    const rfN = nodes.map((n, i) => ({
      id: n.id,
      type: "flowNode",
      position: n.position || { x: 120 + (i % 4) * 320, y: Math.floor(i / 4) * 180 + 60 },
      dragHandle: ".drag-handle",
      data: buildNodeData(n),
    }));
    const rfE = edges.map(e => ({
      id: e.id,
      source: e.from_node_id,
      target: e.to_node_id,
      sourceHandle: e.trigger,
      type: "smoothstep",
      label: e.trigger,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
      style: { stroke: "#94a3b8", strokeWidth: 2 },
      labelStyle: { fontSize: 11, fill: "#64748b" },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
    }));
    setRfNodes(rfN);
    setRfEdges(rfE);
  };

  // Build node data with callbacks
  const buildNodeData = (n) => ({
    type: n.type,
    content: n.content,
    isStart: n.is_start,
    onChange: (nodeId, patch) => {
      setRfNodes(nds => nds.map(nd =>
        nd.id === nodeId ? { ...nd, data: { ...nd.data, ...patch } } : nd
      ));
      markDirty();
    },
    onSetStart: (nodeId, val) => {
      setRfNodes(nds => nds.map(nd => ({
        ...nd,
        data: { ...nd.data, isStart: nd.id === nodeId ? val : (val ? false : nd.data.isStart) },
      })));
      markDirty();
    },
    onDelete: (nodeId) => {
      setDeleteNodeId(nodeId);
      setDeleteNodeOpen(true);
    },
  });

  const selectFlow = async (flow) => {
    // Save current flow before switching
    if (selectedFlowRef.current && saveStatus !== "saved") await doSave();
    setSelectedFlow(flow);
    selectedFlowRef.current = flow;
    setEditKeywords((flow.trigger_keywords || []).join(", "));
    setEditFreeQ(flow.free_questions || false);
    setShowFlowList(false);
    await loadFlow(flow);
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

  const handleAddNode = (type = "message", position = null) => {
    const pos = position || { x: 200 + rfNodes.length * 50, y: 100 + rfNodes.length * 30 };
    const newId = `local_${Date.now()}`;
    const isFirst = rfNodes.length === 0;

    setRfNodes(nds => [...nds, {
      id: newId,
      type: "flowNode",
      position: pos,
      dragHandle: ".drag-handle",
      data: buildNodeData({
        id: newId,
        type,
        content: EMPTY_CONTENT[type] || {},
        is_start: isFirst,
      }),
    }]);
    markDirty();
  };

  const onConnect = useCallback((params) => {
    const trigger = params.sourceHandle || "next";
    setRfEdges(eds => [...eds, {
      id: `e_${Date.now()}`,
      source: params.source,
      target: params.target,
      sourceHandle: trigger,
      type: "smoothstep",
      label: trigger,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
      style: { stroke: "#94a3b8", strokeWidth: 2 },
      labelStyle: { fontSize: 11, fill: "#64748b" },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
    }]);
    markDirty();
  }, [markDirty]);

  const onEdgeClick = useCallback((e, edge) => {
    e.stopPropagation();
    if (!confirm(`Delete connection "${edge.label}"?`)) return;
    setRfEdges(eds => eds.filter(ed => ed.id !== edge.id));
    markDirty();
  }, [markDirty]);

  const confirmDeleteNode = () => {
    setRfNodes(nds => nds.filter(n => n.id !== deleteNodeId));
    setRfEdges(eds => eds.filter(e => e.source !== deleteNodeId && e.target !== deleteNodeId));
    setDeleteNodeId(null);
    setDeleteNodeOpen(false);
    markDirty();
  };

  const confirmDeleteFlow = async () => {
    await fetch(`/api/flows/${flowToDelete.id}`, { method: "DELETE" });
    if (selectedFlow?.id === flowToDelete.id) {
      setSelectedFlow(null); setRfNodes([]); setRfEdges([]); setShowFlowList(true);
    }
    setFlowToDelete(null); setDeleteFlowOpen(false);
    await fetchFlows();
  };

  const handleGoBack = async () => {
    if (saveStatus === "unsaved") await doSave();
    setShowFlowList(true);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, []);

  const SaveIndicator = () => {
    if (saveStatus === "saving") return (
      <span style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4 }}>
        <Loader2 size={12} className="animate-spin" /> Saving...
      </span>
    );
    if (saveStatus === "unsaved") return (
      <span style={{ fontSize: 12, color: "#f59e0b", display: "flex", alignItems: "center", gap: 4 }}>
        <AlertCircle size={12} /> Unsaved changes
      </span>
    );
    return (
      <span style={{ fontSize: 12, color: "#10b981" }}>✓ Saved</span>
    );
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
                      Keywords: {(flow.trigger_keywords||[]).join(", ")}
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
              <button onClick={handleGoBack} className="text-sm text-muted-foreground hover:text-gray-800">← Flows</button>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-semibold">{selectedFlow?.name}</span>
              {selectedFlow?.is_active && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Active</span>
              )}
              <SaveIndicator />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleAddNode("message")}>
                <Plus size={13} className="mr-1" /> Add node
              </Button>
              <Button size="sm" onClick={doSave} disabled={saveStatus === "saving"}>
                <Save size={13} className="mr-1" />
                {saveStatus === "saving" ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleActive(selectedFlow)}>
                {selectedFlow?.is_active ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(s => !s)}>
                <Settings size={13} className="mr-1" /> Settings
              </Button>
            </div>
          </div>

          <div style={{ display: "flex", height: "calc(85vh - 45px)" }}>
            {/* Left panel */}
            <div style={{ width: 160, borderRight: "1px solid #e2e8f0", background: "#fafafa", padding: "12px 10px", display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                Special nodes
              </p>
              {SPECIAL_NODES.map(sn => {
                const c = NODE_COLORS[sn.type];
                return (
                  <div key={sn.type} draggable
                    onDragStart={e => e.dataTransfer.setData("nodeType", sn.type)}
                    style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 8, padding: "8px 10px", cursor: "grab", userSelect: "none" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: c.text, margin: 0 }}>{sn.emoji} {sn.label}</p>
                    <p style={{ fontSize: 10, color: "#94a3b8", margin: "2px 0 0" }}>{sn.desc}</p>
                  </div>
                );
              })}
              <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 6, paddingTop: 8 }}>
                <p style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>
                  Drag onto canvas. Changes auto-save every 30s.
                </p>
              </div>
            </div>

            {/* Canvas */}
            <div ref={reactFlowWrapper} style={{ flex: 1, background: "#f1f5f9" }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const type = e.dataTransfer.getData("nodeType");
                if (!type || !reactFlowInstance) return;
                const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
                handleAddNode(type, position);
              }}>
              <ReactFlow
                nodes={rfNodes} edges={rfEdges}
                onNodesChange={changes => { onNodesChange(changes); if (changes.some(c => c.type === "position" && !c.dragging)) markDirty(); }} onEdgesChange={onEdgesChange}
                onConnect={onConnect} onEdgeClick={onEdgeClick}
                onInit={setReactFlowInstance}
                nodeTypes={nodeTypes} fitView
                panOnScroll panOnScrollMode="free"
                zoomOnPinch zoomOnScroll={false} zoomOnDoubleClick={false}
                panOnDrag={[1, 2]} style={{ cursor: "crosshair" }}
              >
                <Background color="#94a3b8" gap={24} size={1.5} variant="dots" />
                <Controls />
                <MiniMap nodeColor={n => NODE_COLORS[n.data?.type]?.border || "#ccc"} />
                {rfNodes.length === 0 && (
                  <Panel position="top-center">
                    <div className="bg-white border rounded-lg px-4 py-3 text-sm text-muted-foreground shadow-sm mt-4">
                      Click <strong>+ Add node</strong> or drag a special node to start
                    </div>
                  </Panel>
                )}
              </ReactFlow>
            </div>
          </div>

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
                    <p className="text-xs text-muted-foreground mt-0.5">When ON — typed messages get AI answers even in a buttons node</p>
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