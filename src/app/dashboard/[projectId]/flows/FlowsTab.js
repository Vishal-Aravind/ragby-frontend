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
  SelectionMode,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Trash2, X, Settings, Save, AlertCircle } from "lucide-react";
import AppAlertDialog from "@/components/alertdialog";
import AddNodePanel from "./AddNodePanel";
import NodeConfigDialog from "./NodeConfigDialog";
import { nodeInfo, emptyContentFor, canonicalType } from "./nodeRegistry";

const toId = (label) =>
  (label || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `id_${Date.now()}`;

// ─────────────────────────────────────────────────────────
// FLOW NODE — compact card. Full settings live in NodeConfigDialog now;
// this used to expand inline into a 300px-wide accordion with its own
// type-picker dropdown, which is exactly what testing flagged as
// confusing. Clicking the card opens the dialog; there is nothing left
// to configure here.
// ─────────────────────────────────────────────────────────
function FlowNode({ id, data, selected }) {
  const type = data.type || "message";
  const content = data.content || {};
  const isStart = data.isStart || false;
  const info = nodeInfo(type);
  const Icon = info.icon;

  const preview = content.body || (
    type === "time_delay" ? `Wait ${content.delay_seconds || 60} ${content.delay_unit || "seconds"}`
    : type === "message_shop" ? (content.catalog_id ? "Catalog linked" : "No catalog selected")
    : type === "message_booking" ? "Opens booking calendar"
    : type === "message_event" ? (content.event_id ? "Event linked" : "No event selected")
    : info.description
  );

  return (
    <div
      onClick={() => data.onOpen(id)}
      style={{
        background: info.bg,
        border: `2px solid ${selected ? "#3b82f6" : info.border}`,
        borderRadius: 12, minWidth: 200, maxWidth: 240,
        boxShadow: selected ? "0 0 0 3px rgba(59,130,246,0.2)" : "0 2px 8px rgba(0,0,0,0.08)",
        cursor: "pointer",
      }}
      className="drag-handle"
    >
      <Handle type="target" position={Position.Left} style={{ background: info.border, width: 10, height: 10, left: -6 }} />

      <div style={{ padding: "8px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={{ width: 20, height: 20, borderRadius: 6, background: info.badge, color: info.text, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={12} />
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: info.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {info.label}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {isStart && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 20, background: "#fef3c7", color: "#92400e" }}>START</span>}
            <button onClick={e => { e.stopPropagation(); data.onDelete(id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#fca5a5", padding: 2, lineHeight: 1 }}>✕</button>
          </div>
        </div>

        <p style={{ fontSize: 12, color: content.body ? "#374151" : "#9ca3af", margin: "6px 0 0", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.4 }}>
          {preview}
        </p>

        {type === "message_buttons" && (content.buttons || []).length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {(content.buttons || []).map((btn, idx) => (
              <div key={idx} style={{ position: "relative" }}>
                <div style={{ fontSize: 11, padding: "3px 22px 3px 8px", background: "white", border: `1px solid ${info.border}`, borderRadius: 6, color: info.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {btn.label || `Button ${idx + 1}`}
                </div>
                <Handle type="source" position={Position.Right} id={toId(btn.label || `btn_${idx}`)}
                  style={{ background: info.border, width: 10, height: 10, right: -5, top: "50%", transform: "translateY(-50%)", border: "2px solid white" }} />
              </div>
            ))}
          </div>
        )}

        {type === "message_list" && (content.sections || []).flatMap(s => s.rows || []).length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {(content.sections || []).flatMap(s => s.rows || []).map((row, idx) => (
              <div key={idx} style={{ position: "relative" }}>
                <div style={{ fontSize: 11, padding: "3px 22px 3px 8px", background: "white", border: `1px solid ${info.border}`, borderRadius: 6, color: info.text, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.label || `Row ${idx + 1}`}
                </div>
                <Handle type="source" position={Position.Right} id={toId(row.label || `row_${idx}`)}
                  style={{ background: info.border, width: 10, height: 10, right: -5, top: "50%", transform: "translateY(-50%)", border: "2px solid white" }} />
              </div>
            ))}
          </div>
        )}

        {type !== "message_buttons" && type !== "message_list" && (
          <Handle type="source" position={Position.Right} style={{ background: info.border, width: 10, height: 10, right: -6 }} />
        )}
      </div>
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode };

// ─────────────────────────────────────────────────────────
// STARTER TEMPLATE — seeded into a brand-new flow instead of a blank
// canvas. Research on flow/no-code builders consistently flags an empty
// canvas as where first-time users disengage; this gives them a small,
// working, fully-editable example instead.
// ─────────────────────────────────────────────────────────
function starterGraph() {
  const startId = "local_start";
  const menuId = "local_menu";
  const humanId = "local_human";
  const aiId = "local_ai";
  const now = Date.now();
  return {
    nodes: [
      { id: startId, type: "flowNode", position: { x: 80, y: 140 }, dragHandle: ".drag-handle",
        raw: { type: "message", content: { body: "👋 Hi! How can I help you today?" }, is_start: true } },
      { id: menuId, type: "flowNode", position: { x: 400, y: 140 }, dragHandle: ".drag-handle",
        raw: { type: "message_buttons", content: { body: "Choose an option:", buttons: [{ label: "Talk to a human" }, { label: "Ask a question" }] }, is_start: false } },
      { id: humanId, type: "flowNode", position: { x: 720, y: 40 }, dragHandle: ".drag-handle",
        raw: { type: "talk_to_human", content: emptyContentFor("talk_to_human"), is_start: false } },
      { id: aiId, type: "flowNode", position: { x: 720, y: 240 }, dragHandle: ".drag-handle",
        raw: { type: "ask_a_question", content: emptyContentFor("ask_a_question"), is_start: false } },
    ],
    edges: [
      { id: `e_${now}_1`, source: startId, target: menuId, sourceHandle: "next" },
      { id: `e_${now}_2`, source: menuId, target: humanId, sourceHandle: toId("Talk to a human") },
      { id: `e_${now}_3`, source: menuId, target: aiId, sourceHandle: toId("Ask a question") },
    ],
  };
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────
export default function FlowsTab({ projectId }) {
  const [flows, setFlows]               = useState([]);
  const [catalogs, setCatalogs]         = useState([]);
  const [events, setEvents]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);
  const [creatingFlow, setCreatingFlow] = useState(false);
  const [newFlowName, setNewFlowName]   = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFlowList, setShowFlowList] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editKeywords, setEditKeywords] = useState("");
  const [editFreeQ, setEditFreeQ]       = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteFlowOpen, setDeleteFlowOpen] = useState(false);
  const [flowToDelete, setFlowToDelete]     = useState(null);
  const [deleteNodeId, setDeleteNodeId]     = useState(null);
  const [deleteNodeOpen, setDeleteNodeOpen] = useState(false);
  const [addPanelOpen, setAddPanelOpen]     = useState(false);
  const [configNodeId, setConfigNodeId]     = useState(null);

  const [saveStatus, setSaveStatus] = useState("saved");
  const [errorMsg, setErrorMsg]     = useState("");
  const autoSaveTimer    = useRef(null);
  const isLoadingFlow    = useRef(false);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const rfNodesRef      = useRef([]);
  const rfEdgesRef      = useRef([]);
  const selectedFlowRef = useRef(null);
  // The flow's revision as of the last successful load or save. Sent back on
  // every save so the server can reject a write built on a stale copy —
  // two tabs open on the same flow used to silently overwrite each other.
  const revisionRef     = useRef(null);
  // Set when a load fails. Autosave is blocked while this is true: a failed
  // load leaves an EMPTY canvas, and the 30-second timer would then happily
  // write that emptiness over the real flow.
  const loadFailedRef   = useRef(false);

  useEffect(() => { rfNodesRef.current = rfNodes; }, [rfNodes]);
  useEffect(() => { rfEdgesRef.current = rfEdges; }, [rfEdges]);
  useEffect(() => { selectedFlowRef.current = selectedFlow; }, [selectedFlow]);

  // Every one of these calls used to ignore its response. A 403 rendered as
  // "No flows yet", and a rejected save still showed as success.
  const readError = async (res, fallback) => {
    try {
      const body = await res.json();
      return body?.error || fallback;
    } catch {
      return fallback;
    }
  };

  const fetchFlows = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/flows?project_id=${projectId}`);
      if (!res.ok) {
        setErrorMsg(await readError(res, "Could not load your flows."));
        setFlows([]);
      } else {
        setErrorMsg("");
        setFlows((await res.json()) || []);
      }
    } catch {
      setErrorMsg("Could not reach the server. Check your connection.");
      setFlows([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchFlows(); }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/catalogs?project_id=${projectId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setCatalogs(data || []));
    fetch(`/api/events?projectId=${projectId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setEvents(data || []))
      .catch(() => {});
  }, [projectId]);

  const markDirty = useCallback(() => {
    if (isLoadingFlow.current) return;
    // Never schedule an autosave on top of a failed load — see loadFailedRef.
    if (loadFailedRef.current) return;
    setSaveStatus("unsaved");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { doSave(); }, 30000);
  }, []);

  const doSave = useCallback(async () => {
    const flow = selectedFlowRef.current;
    if (!flow) return;
    const nodes = rfNodesRef.current;
    const edges = rfEdgesRef.current;

    setSaveStatus("saving");

    const toIdFn = (label) =>
      (label || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "next";

    const handleRemap = {};
    nodes.forEach(n => {
      if (n.data.type === "message_buttons") {
        handleRemap[n.id] = {};
        (n.data.content?.buttons || []).forEach(btn => {
          if (btn.label) handleRemap[n.id][toIdFn(btn.label)] = toIdFn(btn.label);
        });
      }
      if (n.data.type === "message_list") {
        handleRemap[n.id] = {};
        (n.data.content?.sections || []).flatMap(s => s.rows || []).forEach(row => {
          if (row.label) handleRemap[n.id][toIdFn(row.label)] = toIdFn(row.label);
        });
      }
    });

    const payload = {
      nodes: nodes.map(n => ({
        // Legacy type strings (text/buttons/list/handoff) are canonicalized
        // to their modern equivalents here — safe because backend/flows.py
        // dispatches those pairs identically, confirmed against the source.
        id: n.id, type: canonicalType(n.data.type), content: n.data.content,
        is_start: n.data.isStart, position: n.position,
      })),
      edges: edges.map(e => ({
        from_node_id: e.source, trigger: e.sourceHandle || "next", to_node_id: e.target,
      })),
    };

    let res;
    try {
      res = await fetch(`/api/flows/${flow.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, revision: revisionRef.current }),
      });
    } catch {
      setSaveStatus("unsaved");
      setErrorMsg("Could not reach the server. Your changes are still here — try Save again.");
      return;
    }

    if (!res.ok) {
      setSaveStatus("unsaved");
      if (res.status === 409) {
        // Someone else (or another tab) saved this flow since we loaded it.
        // Refusing is the point: the alternative is silently discarding
        // their work.
        setErrorMsg("This flow was changed somewhere else. Reload the page before saving, or your changes will overwrite theirs.");
      } else {
        setErrorMsg(await readError(res, "Could not save the flow."));
      }
      return;
    }

    const result = await res.json();
    setErrorMsg("");
    if (result.revision != null) revisionRef.current = result.revision;
    if (result.idMap) {
      setRfNodes(nds => nds.map(n => ({ ...n, id: result.idMap[n.id] || n.id })));
      setRfEdges(eds => eds.map(e => ({ ...e, source: result.idMap[e.source] || e.source, target: result.idMap[e.target] || e.target })));
    }
    setSaveStatus("saved");
  }, []);

  const loadFlow = async (flow) => {
    if (isLoadingFlow.current) return;
    isLoadingFlow.current = true;
    setSaveStatus("saved");

    let res;
    try {
      res = await fetch(`/api/flows/${flow.id}/nodes`);
    } catch {
      loadFailedRef.current = true;
      isLoadingFlow.current = false;
      setErrorMsg("Could not reach the server. This flow hasn't loaded — don't edit it yet.");
      return;
    }

    if (!res.ok) {
      // Leave the canvas as-is and mark the load failed. Previously this
      // returned silently, leaving an empty canvas that the next autosave
      // wrote over the real flow.
      loadFailedRef.current = true;
      isLoadingFlow.current = false;
      setErrorMsg(await readError(res, "Could not load this flow. Reload before editing."));
      return;
    }

    const data = await res.json();
    loadFailedRef.current = false;
    revisionRef.current = data.revision ?? null;
    setErrorMsg("");
    buildGraph(data.nodes || [], data.edges || []);
    setSaveStatus("saved");
    setTimeout(() => { isLoadingFlow.current = false; }, 500);
  };

  const buildGraph = (nodes, edges) => {
    setRfNodes([]);
    setRfEdges([]);
    const rfN = nodes.map((n, i) => ({
      id: n.id, type: "flowNode",
      position: n.position || { x: 120 + (i % 4) * 320, y: Math.floor(i / 4) * 180 + 60 },
      dragHandle: ".drag-handle",
      data: buildNodeData(n),
    }));
    const rfE = edges.map(e => ({
      id: e.id, source: e.from_node_id, target: e.to_node_id,
      sourceHandle: e.trigger, type: "smoothstep", label: e.trigger,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
      style: { stroke: "#94a3b8", strokeWidth: 2 },
      labelStyle: { fontSize: 11, fill: "#64748b" },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
    }));
    setRfNodes(rfN);
    setRfEdges(rfE);
  };

  const buildNodeData = (n) => ({
    type: n.type, content: n.content, isStart: n.is_start,
    onOpen: (nodeId) => setConfigNodeId(nodeId),
    onChange: (nodeId, patch) => {
      setRfNodes(nds => {
        const oldNode = nds.find(nd => nd.id === nodeId);
        const oldButtons = oldNode?.data?.content?.buttons || [];
        const newButtons = patch?.content?.buttons || oldButtons;

        if (patch?.content?.buttons && oldButtons.length === newButtons.length) {
          const toIdFn = (label) =>
            (label || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "next";
          const handleMap = {};
          oldButtons.forEach((oldBtn, idx) => {
            const oldHandle = toIdFn(oldBtn.label);
            const newHandle = toIdFn(newButtons[idx]?.label || "");
            if (oldHandle !== newHandle) handleMap[oldHandle] = newHandle;
          });
          if (Object.keys(handleMap).length > 0) {
            setRfEdges(eds => eds.map(e =>
              e.source === nodeId && handleMap[e.sourceHandle]
                ? { ...e, sourceHandle: handleMap[e.sourceHandle], label: handleMap[e.sourceHandle] }
                : e
            ));
          }
        }

        return nds.map(nd => nd.id === nodeId ? { ...nd, data: { ...nd.data, ...patch } } : nd);
      });
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
    if (selectedFlowRef.current && saveStatus === "unsaved"
        && !isLoadingFlow.current && !loadFailedRef.current) {
      await doSave();
    }
    loadFailedRef.current = false;
    revisionRef.current = null;
    setRfNodes([]); setRfEdges([]);
    setSelectedFlow(flow);
    selectedFlowRef.current = flow;
    setEditKeywords((flow.trigger_keywords || []).join(", "));
    setEditFreeQ(flow.free_questions || false);
    setShowFlowList(false);
    await loadFlow(flow);
  };

  // Seeds a small, connected, fully-editable example flow instead of a
  // blank canvas — research on flow-builder onboarding consistently flags
  // the blank canvas as where first-time users disengage.
  const seedStarterTemplate = () => {
    const { nodes, edges } = starterGraph();
    const rfN = nodes.map(n => ({
      id: n.id, type: "flowNode", position: n.position, dragHandle: n.dragHandle,
      data: buildNodeData({ id: n.id, ...n.raw }),
    }));
    const rfE = edges.map(e => ({
      ...e, type: "smoothstep", label: e.sourceHandle,
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
      style: { stroke: "#94a3b8", strokeWidth: 2 },
      labelStyle: { fontSize: 11, fill: "#64748b" },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
    }));
    setRfNodes(rfN);
    setRfEdges(rfE);
    markDirty();
  };

  const handleCreateFlow = async () => {
    if (!newFlowName.trim()) return;
    setCreatingFlow(true);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, name: newFlowName.trim() }),
      });
      if (!res.ok) {
        setErrorMsg(await readError(res, "Could not create the flow."));
      } else {
        const flow = await res.json();
        setErrorMsg("");
        setNewFlowName("");
        setShowCreateModal(false);
        await fetchFlows();
        await selectFlow(flow);
        seedStarterTemplate();
      }
    } catch {
      setErrorMsg("Could not reach the server. Try again.");
    }
    setCreatingFlow(false);
  };

  const handleSaveSettings = async () => {
    if (!selectedFlow) return;
    setSavingSettings(true);
    const keywords = editKeywords.split(",").map(k => k.trim()).filter(Boolean);
    try {
      const res = await fetch(`/api/flows/${selectedFlow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger_keywords: keywords, free_questions: editFreeQ }),
      });
      if (!res.ok) {
        // Was applied to local state unconditionally, so a rejected save
        // still looked like it had worked until the next reload.
        setErrorMsg(await readError(res, "Could not save these settings."));
      } else {
        const saved = await res.json();
        setErrorMsg("");
        setSelectedFlow(f => ({
          ...f,
          trigger_keywords: saved?.trigger_keywords ?? keywords,
          free_questions: saved?.free_questions ?? editFreeQ,
        }));
        await fetchFlows();
        setSettingsOpen(false);
      }
    } catch {
      setErrorMsg("Could not reach the server. Try again.");
    }
    setSavingSettings(false);
  };

  const toggleActive = async (flow, e) => {
    e?.stopPropagation();
    try {
      const res = await fetch(`/api/flows/${flow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !flow.is_active }),
      });
      if (!res.ok) {
        setErrorMsg(await readError(res, "Could not change the flow's status."));
        return;
      }
      setErrorMsg("");
      await fetchFlows();
      if (selectedFlow?.id === flow.id)
        setSelectedFlow(f => ({ ...f, is_active: !f.is_active }));
    } catch {
      setErrorMsg("Could not reach the server. Try again.");
    }
  };

  // Nodes are now added ONLY through AddNodePanel — there used to be a
  // second, disconnected path (drag a "special node" card onto the
  // canvas) that offered a different set of types than this one did.
  const handleAddNode = (type) => {
    const pos = { x: 200 + rfNodes.length * 50, y: 100 + rfNodes.length * 30 };
    const newId = `local_${Date.now()}`;
    const isFirst = rfNodes.length === 0;

    setRfNodes(nds => [...nds, {
      id: newId, type: "flowNode", position: pos, dragHandle: ".drag-handle",
      data: buildNodeData({ id: newId, type, content: emptyContentFor(type), is_start: isFirst }),
    }]);
    markDirty();
  };

  const onConnect = useCallback((params) => {
    const trigger = params.sourceHandle || "next";
    setRfEdges(eds => [...eds, {
      id: `e_${Date.now()}`, source: params.source, target: params.target,
      sourceHandle: trigger, type: "smoothstep", label: trigger,
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
    try {
      const res = await fetch(`/api/flows/${flowToDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        // The route deliberately returns 403 when the delete matched no
        // rows; reporting success regardless is how a flow could appear to
        // be gone and then come back on the next reload.
        setErrorMsg(await readError(res, "Could not delete the flow."));
        setFlowToDelete(null); setDeleteFlowOpen(false);
        return;
      }
      setErrorMsg("");
      if (selectedFlow?.id === flowToDelete.id) {
        setSelectedFlow(null); setRfNodes([]); setRfEdges([]); setShowFlowList(true);
      }
    } catch {
      setErrorMsg("Could not reach the server. Try again.");
    }
    setFlowToDelete(null); setDeleteFlowOpen(false);
    await fetchFlows();
  };

  const handleGoBack = async () => {
    if (saveStatus === "unsaved" && !loadFailedRef.current) await doSave();
    setShowFlowList(true);
  };

  useEffect(() => {
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, []);

  const configNode = rfNodes.find(n => n.id === configNodeId) || null;

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
    return <span style={{ fontSize: 12, color: "#10b981" }}>✓ Saved</span>;
  };

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="text-red-400 hover:text-red-600">
            <X size={14} />
          </button>
        </div>
      )}
      {showFlowList ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Flows</h2>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus size={14} className="mr-1" /> New Flow
              </Button>
            </div>
            {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {/* Only claim there are no flows when we actually know that —
                an error above means we couldn't tell. */}
            {!loading && !errorMsg && flows.length === 0 && (
              <p className="text-sm text-muted-foreground">No flows yet.</p>
            )}
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
              <Button data-tour="flows-add-node" variant="outline" size="sm" onClick={() => setAddPanelOpen(true)}>
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

          <div style={{ height: "calc(85vh - 45px)" }}>
            <div ref={reactFlowWrapper} style={{ height: "100%", background: "#f1f5f9" }}>
              <ReactFlow
                nodes={rfNodes} edges={rfEdges}
                onNodesChange={changes => {
                  onNodesChange(changes);
                  if (changes.some(c => (c.type === "position" && !c.dragging) || c.type === "remove")) markDirty();
                }}
                onEdgesChange={changes => {
                  onEdgesChange(changes);
                  if (changes.some(c => c.type === "remove")) markDirty();
                }}
                onConnect={onConnect} onEdgeClick={onEdgeClick}
                onInit={setReactFlowInstance} nodeTypes={nodeTypes}
                fitView panOnScroll={true} panOnScrollMode="free"
                panOnDrag={[1, 2]} zoomOnPinch={true} zoomOnScroll={false}
                zoomOnDoubleClick={false} selectionOnDrag={true}
                selectionMode={SelectionMode.Partial} multiSelectionKeyCode="Shift"
                selectionKeyCode="Shift" deleteKeyCode="Delete"
                style={{ cursor: "default" }}>
                <Background color="#94a3b8" gap={24} size={1.5} variant="dots" />
                <Controls />
                <MiniMap nodeColor={n => nodeInfo(n.data?.type).border || "#ccc"} />
                {rfNodes.length === 0 && (
                  <Panel position="top-center">
                    <div className="bg-white border rounded-lg px-4 py-3 text-sm text-muted-foreground shadow-sm mt-4">
                      Click <strong>+ Add node</strong> to start building this flow
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

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-20">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4 m-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">New flow</h3>
              <button onClick={() => { setShowCreateModal(false); setNewFlowName(""); }}><X size={16} /></button>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Flow name</p>
              <Input autoFocus placeholder="e.g. Welcome Flow" value={newFlowName}
                onChange={e => setNewFlowName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreateFlow()} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowCreateModal(false); setNewFlowName(""); }}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleCreateFlow} disabled={creatingFlow || !newFlowName.trim()}>
                {creatingFlow ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      <AddNodePanel open={addPanelOpen} onOpenChange={setAddPanelOpen} onSelect={handleAddNode} />

      <NodeConfigDialog
        node={configNode}
        onOpenChange={(open) => { if (!open) setConfigNodeId(null); }}
        onChange={(nodeId, patch) => configNode?.data.onChange(nodeId, patch)}
        onSetStart={(nodeId, val) => configNode?.data.onSetStart(nodeId, val)}
        catalogs={catalogs}
        events={events}
      />

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
