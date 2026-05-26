"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
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
import { Loader2, Plus, Trash2, X, ChevronDown, Info, Settings } from "lucide-react";
import AppAlertDialog from "@/components/alertdialog";

// ── Node type colors ──────────────────────────────────────
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

const RESERVED_BUTTONS = [
  { id: "ask_a_question", title: "Ask a Question",  desc: "Enters RAG mode" },
  { id: "back_to_menu",   title: "↩ Back to Menu",  desc: "Returns to start node" },
  { id: "talk_to_human",  title: "Talk to Human",   desc: "Triggers handoff" },
];

const EMPTY_CONTENT = {
  text:    { body: "" },
  buttons: { body: "", buttons: [{ id: "", title: "" }] },
  list:    { body: "", button_text: "View Options", sections: [{ title: "", rows: [{ id: "", title: "" }] }] },
  rag:     { body: "Ask me anything!" },
  cta_url: { body: "", button_text: "Click Here", url: "" },
  handoff: { body: "Connecting you to our team. Please wait..." },
};

// ── Custom React Flow Node ────────────────────────────────
function FlowNode({ data, selected }) {
  const colors = NODE_COLORS[data.type] || NODE_COLORS.text;
  return (
    <div
      style={{
        background: colors.bg,
        border: `2px solid ${selected ? "#3b82f6" : colors.border}`,
        borderRadius: 12,
        padding: "10px 14px",
        minWidth: 180,
        maxWidth: 220,
        boxShadow: selected ? "0 0 0 3px rgba(59,130,246,0.2)" : "0 2px 8px rgba(0,0,0,0.08)",
        cursor: "pointer",
        transition: "box-shadow 0.15s",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: 10, height: 10 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 7px",
          borderRadius: 20, background: colors.badge, color: colors.text,
          textTransform: "uppercase", letterSpacing: "0.05em"
        }}>
          {NODE_LABELS[data.type]}
        </span>
        {data.isStart && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 7px",
            borderRadius: 20, background: "#fef3c7", color: "#92400e",
            textTransform: "uppercase", letterSpacing: "0.05em"
          }}>Start</span>
        )}
      </div>
      <p style={{
        fontSize: 13, color: "#374151", margin: 0,
        overflow: "hidden", textOverflow: "ellipsis",
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        lineHeight: 1.4,
      }}>
        {data.body || "—"}
      </p>
      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: 10, height: 10 }} />
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode };

// ── Main Component ────────────────────────────────────────
export default function FlowsTab({ projectId }) {
  const [flows, setFlows]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [dbNodes, setDbNodes]           = useState([]);
  const [dbEdges, setDbEdges]           = useState([]);

  // React Flow state
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  // UI state
  const [selectedNode, setSelectedNode] = useState(null);
  const [editorOpen, setEditorOpen]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [creatingFlow, setCreatingFlow] = useState(false);
  const [newFlowName, setNewFlowName]   = useState("");
  const [showFlowList, setShowFlowList] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showReserved, setShowReserved] = useState(false);

  // Flow settings
  const [editKeywords, setEditKeywords]           = useState("");
  const [editFreeQuestions, setEditFreeQuestions] = useState(false);
  const [savingSettings, setSavingSettings]       = useState(false);

  // Node editor
  const [editType, setEditType]       = useState("text");
  const [editContent, setEditContent] = useState({ body: "" });
  const [editIsStart, setEditIsStart] = useState(false);

  // Delete dialogs
  const [deleteFlowOpen, setDeleteFlowOpen] = useState(false);
  const [deleteNodeOpen, setDeleteNodeOpen] = useState(false);
  const [flowToDelete, setFlowToDelete]     = useState(null);
  const [nodeToDelete, setNodeToDelete]     = useState(null);

  // ── Load flows ──────────────────────────────────────────
  const fetchFlows = async () => {
    setLoading(true);
    const res = await fetch(`/api/flows?project_id=${projectId}`);
    if (res.ok) setFlows((await res.json()) || []);
    setLoading(false);
  };

  useEffect(() => { fetchFlows(); }, [projectId]);

  // ── Load nodes + edges, build React Flow graph ──────────
  const fetchNodes = async (flowId) => {
    const res = await fetch(`/api/flows/${flowId}/nodes`);
    if (!res.ok) return;
    const data = await res.json();
    setDbNodes(data.nodes || []);
    setDbEdges(data.edges || []);
    buildGraph(data.nodes || [], data.edges || []);
  };

  const buildGraph = (nodes, edges) => {
    // Auto-layout nodes in a vertical tree
    const rfN = nodes.map((n, i) => ({
      id: n.id,
      type: "flowNode",
      position: n.position || { x: 100 + (i % 3) * 250, y: Math.floor(i / 3) * 160 + 80 },
      data: {
        ...n,
        body: n.content?.body || "",
        isStart: n.is_start,
      },
      selected: false,
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
    setEditFreeQuestions(flow.free_questions || false);
    setSelectedNode(null);
    setEditorOpen(false);
    setShowFlowList(false);
    await fetchNodes(flow.id);
  };

  // ── Create flow ──────────────────────────────────────────
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

  // ── Save flow settings ───────────────────────────────────
  const handleSaveSettings = async () => {
    if (!selectedFlow) return;
    setSavingSettings(true);
    const keywords = editKeywords.split(",").map(k => k.trim()).filter(Boolean);
    await fetch(`/api/flows/${selectedFlow.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger_keywords: keywords, free_questions: editFreeQuestions }),
    });
    setSelectedFlow(f => ({ ...f, trigger_keywords: keywords, free_questions: editFreeQuestions }));
    await fetchFlows();
    setSavingSettings(false);
    setSettingsOpen(false);
  };

  // ── Toggle active ────────────────────────────────────────
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

  // ── Add node ─────────────────────────────────────────────
  const handleAddNode = async (type = "text") => {
    if (!selectedFlow) return;
    const content = EMPTY_CONTENT[type];
    const res = await fetch(`/api/flows/${selectedFlow.id}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        content,
        is_start: dbNodes.length === 0,
      }),
    });
    if (res.ok) {
      const node = await res.json();
      await fetchNodes(selectedFlow.id);
      openEditor({ ...node });
    }
  };

  // ── Connect nodes (drag edge) ─────────────────────────────
  const onConnect = useCallback(async (params) => {
    if (!selectedFlow) return;
    const trigger = prompt("Button/List ID that triggers this connection:\n(e.g. browse_products, ask_a_question)");
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

  // ── Delete edge on click ──────────────────────────────────
  const onEdgeClick = useCallback(async (e, edge) => {
    e.stopPropagation();
    if (!confirm(`Delete connection "${edge.label}"?`)) return;
    await fetch(`/api/flows/edges/${edge.id}`, { method: "DELETE" });
    await fetchNodes(selectedFlow.id);
  }, [selectedFlow]);

  // ── Open node editor ──────────────────────────────────────
  const openEditor = (node) => {
    setSelectedNode(node);
    setEditType(node.type);
    setEditContent(node.content);
    setEditIsStart(node.is_start);
    setEditorOpen(true);
  };

  const onNodeClick = useCallback((e, node) => {
    const dbNode = dbNodes.find(n => n.id === node.id);
    if (dbNode) openEditor(dbNode);
  }, [dbNodes]);

  // ── Save node ─────────────────────────────────────────────
  const handleSaveNode = async () => {
    if (!selectedNode) return;
    setSaving(true);
    await fetch(`/api/flows/nodes/${selectedNode.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: editType, content: editContent, is_start: editIsStart }),
    });
    await fetchNodes(selectedFlow.id);
    setSaving(false);
    setEditorOpen(false);
  };

  // ── Delete node ───────────────────────────────────────────
  const confirmDeleteNode = async () => {
    await fetch(`/api/flows/nodes/${nodeToDelete.id}`, { method: "DELETE" });
    if (selectedNode?.id === nodeToDelete.id) { setSelectedNode(null); setEditorOpen(false); }
    setNodeToDelete(null); setDeleteNodeOpen(false);
    await fetchNodes(selectedFlow.id);
  };

  // ── Delete flow ───────────────────────────────────────────
  const confirmDeleteFlow = async () => {
    await fetch(`/api/flows/${flowToDelete.id}`, { method: "DELETE" });
    if (selectedFlow?.id === flowToDelete.id) {
      setSelectedFlow(null); setRfNodes([]); setRfEdges([]);
      setEditorOpen(false); setShowFlowList(true);
    }
    setFlowToDelete(null); setDeleteFlowOpen(false);
    await fetchFlows();
  };

  // ── Content helpers ───────────────────────────────────────
  const updateContent = (key, value) => setEditContent(prev => ({ ...prev, [key]: value }));
  const updateButton = (idx, field, value) => {
    const btns = [...(editContent.buttons || [])];
    btns[idx] = { ...btns[idx], [field]: value };
    updateContent("buttons", btns);
  };
  const addButton = () => {
    if ((editContent.buttons || []).length >= 3) return;
    updateContent("buttons", [...(editContent.buttons || []), { id: "", title: "" }]);
  };
  const removeButton = (idx) => {
    const btns = [...(editContent.buttons || [])]; btns.splice(idx, 1);
    updateContent("buttons", btns);
  };
  const updateListRow = (sIdx, rIdx, field, value) => {
    const sections = JSON.parse(JSON.stringify(editContent.sections || []));
    sections[sIdx].rows[rIdx][field] = value;
    updateContent("sections", sections);
  };
  const addListRow = (sIdx) => {
    const sections = JSON.parse(JSON.stringify(editContent.sections || []));
    sections[sIdx].rows.push({ id: "", title: "" });
    updateContent("sections", sections);
  };
  const removeListRow = (sIdx, rIdx) => {
    const sections = JSON.parse(JSON.stringify(editContent.sections || []));
    sections[sIdx].rows.splice(rIdx, 1);
    updateContent("sections", sections);
  };

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Flow list / selector ── */}
      {showFlowList ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Flows</h2>
            <div className="flex gap-2">
              <Input
                placeholder="Flow name e.g. Welcome Flow"
                value={newFlowName}
                onChange={e => setNewFlowName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreateFlow()}
              />
              <Button onClick={handleCreateFlow} disabled={creatingFlow || !newFlowName.trim()}>
                {creatingFlow ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                Create
              </Button>
            </div>

            {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {!loading && flows.length === 0 && (
              <p className="text-sm text-muted-foreground">No flows yet. Create your first flow above.</p>
            )}

            <div className="space-y-2">
              {flows.map(flow => (
                <div
                  key={flow.id}
                  className="flex items-center justify-between border rounded px-3 py-2 cursor-pointer hover:border-blue-300 transition-colors"
                  onClick={() => selectFlow(flow)}
                >
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

        /* ── Flow canvas ── */
        <div className="border rounded-xl overflow-hidden" style={{ height: "80vh" }}>

          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-white">
            <div className="flex items-center gap-3">
              <button onClick={() => { setShowFlowList(true); setEditorOpen(false); }} className="text-sm text-muted-foreground hover:text-gray-800 flex items-center gap-1">
                ← Flows
              </button>
              <span className="text-gray-300">/</span>
              <span className="text-sm font-semibold">{selectedFlow?.name}</span>
              {selectedFlow?.is_active && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Active</span>
              )}
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

          <div className="flex h-full">

            {/* Left sidebar — add nodes */}
            <div className="w-48 border-r bg-gray-50 p-3 space-y-2 shrink-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Add node</p>
              {NODE_TYPES_LIST.map(t => (
                <button
                  key={t.value}
                  onClick={() => handleAddNode(t.value)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm text-left"
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              ))}

              <div className="pt-3 border-t">
                <button
                  className="w-full text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-2 text-left hover:bg-amber-100 transition-colors"
                  onClick={() => setShowReserved(r => !r)}
                >
                  <Info size={11} className="inline mr-1" />
                  Special IDs
                </button>
                {showReserved && (
                  <div className="mt-2 space-y-1">
                    {RESERVED_BUTTONS.map(rb => (
                      <div key={rb.id} className="text-xs bg-white border rounded p-2">
                        <code className="font-mono text-blue-600 block">{rb.id}</code>
                        <span className="text-muted-foreground">{rb.desc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative">
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                nodeTypes={nodeTypes}
                fitView
                deleteKeyCode="Delete"
              >
                <Background color="#e2e8f0" gap={20} />
                <Controls />
                <MiniMap nodeColor={n => NODE_COLORS[n.data?.type]?.border || "#ccc"} />
                {dbNodes.length === 0 && (
                  <Panel position="top-center">
                    <div className="bg-white border rounded-lg px-4 py-3 text-sm text-muted-foreground shadow-sm mt-4">
                      👈 Click a node type on the left to add your first node
                    </div>
                  </Panel>
                )}
              </ReactFlow>

              {/* Node editor slide-in panel */}
              {editorOpen && selectedNode && (
                <div className="absolute top-0 right-0 h-full w-80 bg-white border-l shadow-xl overflow-y-auto z-10">
                  <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Edit node</span>
                      <NodeBadge type={editType} />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => { setNodeToDelete(selectedNode); setDeleteNodeOpen(true); }}
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditorOpen(false)}>
                        <X size={14} />
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Is start */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editIsStart} onChange={e => setEditIsStart(e.target.checked)} />
                      <span className="text-sm">Set as start node</span>
                    </label>

                    {/* Node type */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Node type</p>
                      <div className="grid grid-cols-3 gap-1">
                        {NODE_TYPES_LIST.map(t => (
                          <button
                            key={t.value}
                            onClick={() => { setEditType(t.value); setEditContent(EMPTY_CONTENT[t.value]); }}
                            className={`text-xs px-1 py-2 rounded border transition-colors ${editType === t.value ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 hover:border-gray-300 text-gray-600"}`}
                          >
                            {t.emoji} {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── Text ── */}
                    {editType === "text" && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Message</p>
                        <textarea className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" rows={4}
                          value={editContent.body || ""} onChange={e => updateContent("body", e.target.value)} placeholder="Enter your message..." />
                      </div>
                    )}

                    {/* ── Buttons ── */}
                    {editType === "buttons" && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Message</p>
                          <textarea className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" rows={2}
                            value={editContent.body || ""} onChange={e => updateContent("body", e.target.value)} placeholder="Message above buttons..." />
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Buttons (max 3)</p>
                          {(editContent.buttons || []).map((btn, idx) => (
                            <div key={idx} className="border rounded p-2 space-y-1">
                              <div className="flex gap-1 items-center">
                                <Input placeholder="Label" value={btn.title} onChange={e => updateButton(idx, "title", e.target.value)} className="flex-1 text-sm h-8" />
                                <button onClick={() => removeButton(idx)} className="text-red-400 hover:text-red-600 shrink-0"><Trash2 size={13} /></button>
                              </div>
                              <Input placeholder="ID (e.g. ask_a_question)" value={btn.id}
                                onChange={e => updateButton(idx, "id", e.target.value.replace(/\s/g, "_").toLowerCase())}
                                className="text-xs font-mono h-8" />
                              {RESERVED_BUTTONS.find(r => r.id === btn.id) && (
                                <p className="text-xs text-amber-600">✓ {RESERVED_BUTTONS.find(r => r.id === btn.id)?.desc}</p>
                              )}
                            </div>
                          ))}
                          {(editContent.buttons || []).length < 3 && (
                            <Button variant="outline" size="sm" onClick={addButton} className="w-full">
                              <Plus size={12} className="mr-1" /> Add button
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded p-2">
                          💡 Connect nodes by dragging from the bottom handle of this node to another node's top handle
                        </p>
                      </div>
                    )}

                    {/* ── List ── */}
                    {editType === "list" && (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Message</p>
                          <textarea className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" rows={2}
                            value={editContent.body || ""} onChange={e => updateContent("body", e.target.value)} placeholder="Message above list..." />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Button text</p>
                          <Input value={editContent.button_text || ""} onChange={e => updateContent("button_text", e.target.value)} placeholder="View Options" className="h-8 text-sm" />
                        </div>
                        {(editContent.sections || []).map((section, sIdx) => (
                          <div key={sIdx} className="border rounded p-2 space-y-2">
                            <Input placeholder="Section title" value={section.title}
                              onChange={e => { const s = JSON.parse(JSON.stringify(editContent.sections)); s[sIdx].title = e.target.value; updateContent("sections", s); }}
                              className="text-sm h-8" />
                            {section.rows.map((row, rIdx) => (
                              <div key={rIdx} className="flex gap-1 items-start">
                                <div className="flex-1 space-y-1">
                                  <Input placeholder="Row title" value={row.title} onChange={e => updateListRow(sIdx, rIdx, "title", e.target.value)} className="text-sm h-8" />
                                  <Input placeholder="Row ID" value={row.id} onChange={e => updateListRow(sIdx, rIdx, "id", e.target.value.replace(/\s/g, "_").toLowerCase())} className="text-xs font-mono h-8" />
                                </div>
                                <button onClick={() => removeListRow(sIdx, rIdx)} className="text-red-400 hover:text-red-600 mt-1"><Trash2 size={12} /></button>
                              </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => addListRow(sIdx)} className="w-full h-7 text-xs">
                              <Plus size={11} className="mr-1" /> Add row
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── RAG ── */}
                    {editType === "rag" && (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Intro message</p>
                          <textarea className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" rows={2}
                            value={editContent.body || ""} onChange={e => updateContent("body", e.target.value)} placeholder="Message before AI takes over..." />
                        </div>
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">
                          Every AI answer gets a [Back to Menu] button automatically.
                        </p>
                      </div>
                    )}

                    {/* ── CTA URL ── */}
                    {editType === "cta_url" && (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Message</p>
                          <textarea className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" rows={2}
                            value={editContent.body || ""} onChange={e => updateContent("body", e.target.value)} placeholder="Message above button..." />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Button text</p>
                          <Input value={editContent.button_text || ""} onChange={e => updateContent("button_text", e.target.value)} placeholder="Order Now" className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">URL</p>
                          <Input value={editContent.url || ""} onChange={e => updateContent("url", e.target.value)} placeholder="https://yoursite.com?wa={{phone_number}}" className="h-8 text-sm" />
                        </div>
                      </div>
                    )}

                    {/* ── Handoff ── */}
                    {editType === "handoff" && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Message</p>
                        <textarea className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200" rows={2}
                          value={editContent.body || ""} onChange={e => updateContent("body", e.target.value)} placeholder="Connecting you to our team..." />
                      </div>
                    )}

                    <Button onClick={handleSaveNode} disabled={saving} className="w-full">
                      {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                      Save node
                    </Button>
                  </div>
                </div>
              )}
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
                  <input type="checkbox" id="fq" checked={editFreeQuestions} onChange={e => setEditFreeQuestions(e.target.checked)} className="mt-0.5" />
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

      {/* Delete dialogs */}
      <AppAlertDialog
        open={deleteFlowOpen}
        title="Delete flow?"
        description={<>Flow <strong>{flowToDelete?.name}</strong> and all its nodes will be permanently deleted.</>}
        confirmText="Delete" cancelText="Cancel"
        onConfirm={confirmDeleteFlow}
        onCancel={() => { setDeleteFlowOpen(false); setFlowToDelete(null); }}
      />
      <AppAlertDialog
        open={deleteNodeOpen}
        title="Delete node?"
        description="This node and all its connections will be permanently deleted."
        confirmText="Delete" cancelText="Cancel"
        onConfirm={confirmDeleteNode}
        onCancel={() => { setDeleteNodeOpen(false); setNodeToDelete(null); }}
      />
    </div>
  );
}

function NodeBadge({ type }) {
  const colors = NODE_COLORS[type] || { badge: "#f1f5f9", text: "#475569" };
  return (
    <span style={{ background: colors.badge, color: colors.text, fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
      {NODE_LABELS[type]}
    </span>
  );
}