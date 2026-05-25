"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, ChevronRight, Zap } from "lucide-react";
import AppAlertDialog from "@/components/alertdialog";

const NODE_TYPES = [
  { value: "text",    label: "Text",      desc: "Send a plain message" },
  { value: "buttons", label: "Buttons",   desc: "Up to 3 reply buttons" },
  { value: "list",    label: "List",      desc: "Up to 10 items in a list" },
  { value: "rag",     label: "AI Answer", desc: "Let AI answer freely" },
  { value: "cta_url", label: "Send Link", desc: "CTA button with URL" },
  { value: "handoff", label: "Handoff",   desc: "Transfer to human" },
];

const EMPTY_CONTENT = {
  text:    { body: "" },
  buttons: { body: "", buttons: [{ id: "", title: "" }] },
  list:    { body: "", button_text: "View Options", sections: [{ title: "", rows: [{ id: "", title: "", description: "" }] }] },
  rag:     { body: "Ask me anything!", rag_exit_keywords: ["menu", "back"] },
  cta_url: { body: "", button_text: "Click Here", url: "" },
  handoff: { body: "Connecting you to our team. Please wait..." },
};

export default function FlowsTab({ projectId }) {
  const [flows, setFlows]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [nodes, setNodes]             = useState([]);
  const [edges, setEdges]             = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [saving, setSaving]           = useState(false);
  const [creatingFlow, setCreatingFlow] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");

  // Delete dialogs
  const [deleteFlowOpen, setDeleteFlowOpen]   = useState(false);
  const [deleteNodeOpen, setDeleteNodeOpen]   = useState(false);
  const [flowToDelete, setFlowToDelete]       = useState(null);
  const [nodeToDelete, setNodeToDelete]       = useState(null);

  // Node editor state
  const [editType, setEditType]       = useState("text");
  const [editContent, setEditContent] = useState({ body: "" });
  const [editIsStart, setEditIsStart] = useState(false);

  // ── Load flows ──────────────────────────────────────
  const fetchFlows = async () => {
    setLoading(true);
    const res = await fetch(`/api/flows?project_id=${projectId}`);
    if (res.ok) {
      const data = await res.json();
      setFlows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchFlows(); }, [projectId]);

  // ── Load nodes + edges for selected flow ────────────
  const fetchNodes = async (flowId) => {
    const res = await fetch(`/api/flows/${flowId}/nodes`);
    if (res.ok) {
      const data = await res.json();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    }
  };

  const selectFlow = async (flow) => {
    setSelectedFlow(flow);
    setSelectedNode(null);
    await fetchNodes(flow.id);
  };

  // ── Select node to edit ──────────────────────────────
  const selectNode = (node) => {
    setSelectedNode(node);
    setEditType(node.type);
    setEditContent(node.content);
    setEditIsStart(node.is_start);
  };

  // ── Create flow ──────────────────────────────────────
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

  // ── Toggle flow active ───────────────────────────────
  const toggleActive = async (flow) => {
    await fetch(`/api/flows/${flow.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !flow.is_active }),
    });
    await fetchFlows();
    if (selectedFlow?.id === flow.id) {
      setSelectedFlow(f => ({ ...f, is_active: !f.is_active }));
    }
  };

  // ── Delete flow ──────────────────────────────────────
  const confirmDeleteFlow = async () => {
    await fetch(`/api/flows/${flowToDelete.id}`, { method: "DELETE" });
    if (selectedFlow?.id === flowToDelete.id) {
      setSelectedFlow(null);
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
    }
    setFlowToDelete(null);
    setDeleteFlowOpen(false);
    await fetchFlows();
  };

  // ── Add node ─────────────────────────────────────────
  const handleAddNode = async () => {
    if (!selectedFlow) return;
    const res = await fetch(`/api/flows/${selectedFlow.id}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "text",
        content: { body: "New message" },
        is_start: nodes.length === 0,
      }),
    });
    if (res.ok) {
      const node = await res.json();
      await fetchNodes(selectedFlow.id);
      selectNode({ ...node });
    }
  };

  // ── Save node ─────────────────────────────────────────
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
  };

  // ── Delete node ──────────────────────────────────────
  const confirmDeleteNode = async () => {
    await fetch(`/api/flows/nodes/${nodeToDelete.id}`, { method: "DELETE" });
    if (selectedNode?.id === nodeToDelete.id) setSelectedNode(null);
    setNodeToDelete(null);
    setDeleteNodeOpen(false);
    await fetchNodes(selectedFlow.id);
  };

  // ── Save edge (button → node connection) ─────────────
  const handleSaveEdge = async (trigger, toNodeId) => {
    if (!selectedFlow || !selectedNode) return;
    // Delete existing edge for this trigger first
    const existing = edges.find(e => e.from_node_id === selectedNode.id && e.trigger === trigger);
    if (existing) await fetch(`/api/flows/edges/${existing.id}`, { method: "DELETE" });
    if (!toNodeId) return;
    await fetch(`/api/flows/${selectedFlow.id}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_node_id: selectedNode.id, trigger, to_node_id: toNodeId }),
    });
    await fetchNodes(selectedFlow.id);
  };

  // ── Content helpers ───────────────────────────────────
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
    const btns = [...(editContent.buttons || [])];
    btns.splice(idx, 1);
    updateContent("buttons", btns);
  };

  const updateListRow = (sIdx, rIdx, field, value) => {
    const sections = JSON.parse(JSON.stringify(editContent.sections || []));
    sections[sIdx].rows[rIdx][field] = value;
    updateContent("sections", sections);
  };

  const addListRow = (sIdx) => {
    const sections = JSON.parse(JSON.stringify(editContent.sections || []));
    sections[sIdx].rows.push({ id: "", title: "", description: "" });
    updateContent("sections", sections);
  };

  const removeListRow = (sIdx, rIdx) => {
    const sections = JSON.parse(JSON.stringify(editContent.sections || []));
    sections[sIdx].rows.splice(rIdx, 1);
    updateContent("sections", sections);
  };

  const nodePreview = (node) => node.content?.body?.slice(0, 40) || "—";

  const getEdgeTarget = (trigger) =>
    edges.find(e => e.from_node_id === selectedNode?.id && e.trigger === trigger)?.to_node_id || "";

  // ── UI ────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Flow list ── */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Flows</h2>
          </div>

          {/* Create new flow */}
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
                className={`flex items-center justify-between border rounded px-3 py-2 cursor-pointer transition-colors ${selectedFlow?.id === flow.id ? "border-blue-500 bg-blue-50" : "hover:border-gray-300"}`}
                onClick={() => selectFlow(flow)}
              >
                <div className="flex items-center gap-2">
                  <ChevronRight size={14} className="text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{flow.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Keywords: {(flow.trigger_keywords || []).join(", ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${flow.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                    {flow.is_active ? "Active" : "Inactive"}
                  </span>
                  <Button
                    variant="outline" size="sm"
                    onClick={e => { e.stopPropagation(); toggleActive(flow); }}
                  >
                    {flow.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={e => { e.stopPropagation(); setFlowToDelete(flow); setDeleteFlowOpen(true); }}
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Flow editor ── */}
      {selectedFlow && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Editing: {selectedFlow.name}</h2>
              <Button onClick={handleAddNode} size="sm">
                <Plus size={14} className="mr-1" /> Add node
              </Button>
            </div>

            {nodes.length === 0 && (
              <p className="text-sm text-muted-foreground">No nodes yet. Click "Add node" to start building your flow.</p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Left — node list */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Nodes</p>
                {nodes.map(node => (
                  <div
                    key={node.id}
                    className={`flex items-center justify-between border rounded px-3 py-2 cursor-pointer transition-colors ${selectedNode?.id === node.id ? "border-blue-500 bg-blue-50" : "hover:border-gray-300"}`}
                    onClick={() => selectNode(node)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <NodeTypeBadge type={node.type} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{nodePreview(node)}</p>
                        <p className="text-xs text-muted-foreground">{NODE_TYPES.find(t => t.value === node.type)?.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {node.is_start && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Start</span>
                      )}
                      <Button
                        variant="ghost" size="sm"
                        onClick={e => { e.stopPropagation(); setNodeToDelete(node); setDeleteNodeOpen(true); }}
                      >
                        <Trash2 size={13} className="text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Right — node editor */}
              {selectedNode && (
                <div className="border rounded-lg p-4 space-y-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Node editor</p>

                  {/* Is start toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsStart}
                      onChange={e => setEditIsStart(e.target.checked)}
                    />
                    <span className="text-sm">Set as start node</span>
                  </label>

                  {/* Node type selector */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Node type</p>
                    <div className="grid grid-cols-3 gap-1">
                      {NODE_TYPES.map(t => (
                        <button
                          key={t.value}
                          onClick={() => {
                            setEditType(t.value);
                            setEditContent(EMPTY_CONTENT[t.value]);
                          }}
                          className={`text-xs px-2 py-2 rounded border transition-colors ${editType === t.value ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 hover:border-gray-300 text-gray-600"}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Text node ── */}
                  {editType === "text" && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Message</p>
                      <textarea
                        className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                        rows={3}
                        value={editContent.body || ""}
                        onChange={e => updateContent("body", e.target.value)}
                        placeholder="Enter your message..."
                      />
                    </div>
                  )}

                  {/* ── Buttons node ── */}
                  {editType === "buttons" && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Message</p>
                        <textarea
                          className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                          rows={2}
                          value={editContent.body || ""}
                          onChange={e => updateContent("body", e.target.value)}
                          placeholder="Message above the buttons..."
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Buttons (max 3)</p>
                        {(editContent.buttons || []).map((btn, idx) => (
                          <div key={idx} className="space-y-1 border rounded p-2">
                            <div className="flex gap-2 items-center">
                              <Input
                                placeholder="Button label"
                                value={btn.title}
                                onChange={e => updateButton(idx, "title", e.target.value)}
                                className="flex-1 text-sm"
                              />
                              <Input
                                placeholder="ID (no spaces)"
                                value={btn.id}
                                onChange={e => updateButton(idx, "id", e.target.value.replace(/\s/g, "_").toLowerCase())}
                                className="w-28 text-sm font-mono"
                              />
                              <button onClick={() => removeButton(idx)} className="text-red-400 hover:text-red-600">
                                <Trash2 size={13} />
                              </button>
                            </div>
                            {/* Connect to node */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">→ goes to</span>
                              <select
                                className="flex-1 text-xs border rounded px-2 py-1"
                                value={getEdgeTarget(btn.id)}
                                onChange={e => handleSaveEdge(btn.id, e.target.value)}
                              >
                                <option value="">— select node —</option>
                                {nodes.filter(n => n.id !== selectedNode.id).map(n => (
                                  <option key={n.id} value={n.id}>{nodePreview(n)}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                        {(editContent.buttons || []).length < 3 && (
                          <Button variant="outline" size="sm" onClick={addButton}>
                            <Plus size={13} className="mr-1" /> Add button
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── List node ── */}
                  {editType === "list" && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Message</p>
                        <textarea
                          className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                          rows={2}
                          value={editContent.body || ""}
                          onChange={e => updateContent("body", e.target.value)}
                          placeholder="Message above the list..."
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Button text</p>
                        <Input
                          value={editContent.button_text || ""}
                          onChange={e => updateContent("button_text", e.target.value)}
                          placeholder="View Options"
                        />
                      </div>
                      {(editContent.sections || []).map((section, sIdx) => (
                        <div key={sIdx} className="border rounded p-3 space-y-2">
                          <Input
                            placeholder="Section title"
                            value={section.title}
                            onChange={e => {
                              const sections = JSON.parse(JSON.stringify(editContent.sections));
                              sections[sIdx].title = e.target.value;
                              updateContent("sections", sections);
                            }}
                            className="text-sm"
                          />
                          {section.rows.map((row, rIdx) => (
                            <div key={rIdx} className="flex gap-2 items-start">
                              <div className="flex-1 space-y-1">
                                <Input
                                  placeholder="Row title"
                                  value={row.title}
                                  onChange={e => updateListRow(sIdx, rIdx, "title", e.target.value)}
                                  className="text-sm"
                                />
                                <Input
                                  placeholder="Row ID (no spaces)"
                                  value={row.id}
                                  onChange={e => updateListRow(sIdx, rIdx, "id", e.target.value.replace(/\s/g, "_").toLowerCase())}
                                  className="text-sm font-mono"
                                />
                                {/* Connect list row to node */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">→ goes to</span>
                                  <select
                                    className="flex-1 text-xs border rounded px-2 py-1"
                                    value={getEdgeTarget(row.id)}
                                    onChange={e => handleSaveEdge(row.id, e.target.value)}
                                  >
                                    <option value="">— select node —</option>
                                    {nodes.filter(n => n.id !== selectedNode.id).map(n => (
                                      <option key={n.id} value={n.id}>{nodePreview(n)}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <button onClick={() => removeListRow(sIdx, rIdx)} className="text-red-400 hover:text-red-600 mt-1">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" onClick={() => addListRow(sIdx)}>
                            <Plus size={13} className="mr-1" /> Add row
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── RAG node ── */}
                  {editType === "rag" && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Intro message</p>
                        <textarea
                          className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                          rows={2}
                          value={editContent.body || ""}
                          onChange={e => updateContent("body", e.target.value)}
                          placeholder="Message shown before AI takes over..."
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Exit keywords (comma separated)</p>
                        <Input
                          value={(editContent.rag_exit_keywords || []).join(", ")}
                          onChange={e => updateContent("rag_exit_keywords", e.target.value.split(",").map(k => k.trim()).filter(Boolean))}
                          placeholder="menu, back, stop"
                        />
                        <p className="text-xs text-muted-foreground">User types one of these → returns to flow</p>
                      </div>
                    </div>
                  )}

                  {/* ── CTA URL node ── */}
                  {editType === "cta_url" && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Message</p>
                        <textarea
                          className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                          rows={2}
                          value={editContent.body || ""}
                          onChange={e => updateContent("body", e.target.value)}
                          placeholder="Message above the button..."
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Button text</p>
                        <Input
                          value={editContent.button_text || ""}
                          onChange={e => updateContent("button_text", e.target.value)}
                          placeholder="Order Now"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">URL</p>
                        <Input
                          value={editContent.url || ""}
                          onChange={e => updateContent("url", e.target.value)}
                          placeholder="https://yoursite.com/menu?wa={{phone_number}}"
                        />
                        <p className="text-xs text-muted-foreground">Use {"{{phone_number}}"} to pass the user's number</p>
                      </div>
                    </div>
                  )}

                  {/* ── Handoff node ── */}
                  {editType === "handoff" && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Message</p>
                      <textarea
                        className="w-full border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                        rows={2}
                        value={editContent.body || ""}
                        onChange={e => updateContent("body", e.target.value)}
                        placeholder="Connecting you to our team..."
                      />
                    </div>
                  )}

                  <Button onClick={handleSaveNode} disabled={saving} className="w-full">
                    {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                    Save node
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete dialogs */}
      <AppAlertDialog
        open={deleteFlowOpen}
        title="Delete flow?"
        description={<>Flow <strong>{flowToDelete?.name}</strong> and all its nodes will be permanently deleted.</>}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteFlow}
        onCancel={() => { setDeleteFlowOpen(false); setFlowToDelete(null); }}
      />
      <AppAlertDialog
        open={deleteNodeOpen}
        title="Delete node?"
        description="This node and all its connections will be permanently deleted."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteNode}
        onCancel={() => { setDeleteNodeOpen(false); setNodeToDelete(null); }}
      />
    </div>
  );
}

function NodeTypeBadge({ type }) {
  const colors = {
    text:    "bg-emerald-50 text-emerald-700",
    buttons: "bg-blue-50 text-blue-700",
    list:    "bg-purple-50 text-purple-700",
    rag:     "bg-amber-50 text-amber-700",
    cta_url: "bg-orange-50 text-orange-700",
    handoff: "bg-red-50 text-red-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded shrink-0 font-medium ${colors[type] || "bg-gray-50 text-gray-600"}`}>
      {type}
    </span>
  );
}