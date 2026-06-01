// src/app/dashboard/[projectId]/ProjectClient.js

"use client";

import { useEffect, useState } from "react";
import DocumentsTab from "./DocumentsTab";
import IntegrationsTab from "./IntegrationsTab";
import LeadsTab from "./LeadsTab";
import ChatTab from "./ChatTab";
import FlowsTab from "./FlowsTab";
import ConversationsTab from "./ConversationsTab";
import AnalyticsTab from "./AnalyticsTab";
import ApiKeysTab from "./ApiKeysTab";


import { Button } from "@/components/ui/button";
import AppAlertDialog from "@/components/alertdialog";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];

const DOMAINS = [
  "Healthcare",
  "Insurance",
  "Sales",
  "Finance",
  "Legal",
  "Education",
  "Other",
];

export default function ProjectClient({ project }) {
  const [activeTab, setActiveTab] = useState("documents");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  const [connecting, setConnecting] = useState(false);
  const [sources, setSources] = useState([]);

  // Domain state
  const [domain, setDomain] = useState(project.domain || "");
  const [savingDomain, setSavingDomain] = useState(false);
  const [domainSaved, setDomainSaved] = useState(false);

  // --------------------------------------------------
  // LOAD FILES
  // --------------------------------------------------
  useEffect(() => {
    if (!project?.id) return;
    const loadFiles = async () => {
      const res = await fetch(`/api/files?projectId=${project.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setFiles(
        (data || []).map((f) => ({
          id: f.id,
          name: f.filename,
          status: f.status,
          fromDb: true,
        }))
      );
    };
    loadFiles();
  }, [project.id]);

  // --------------------------------------------------
  // LOAD SOURCES
  // --------------------------------------------------
  const fetchSources = async () => {
    const res = await fetch(`/api/sources?project_id=${project.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setSources(data || []);
  };

  useEffect(() => {
    if (!project?.id) return;
    fetchSources();
  }, [project.id]);

  // --------------------------------------------------
  // SAVE DOMAIN — auto-saves on change
  // --------------------------------------------------
  const handleDomainChange = async (value) => {
    setDomain(value);
    setSavingDomain(true);
    setDomainSaved(false);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: value }),
      });
      setDomainSaved(true);
      setTimeout(() => setDomainSaved(false), 2000);
    } finally {
      setSavingDomain(false);
    }
  };

  // --------------------------------------------------
  // FILE SELECTION
  // --------------------------------------------------
  const handleSelectFiles = (selectedFiles) => {
    for (const file of selectedFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) continue;
      const exists = files.find((f) => f.name === file.name && f.fromDb);
      if (exists) {
        setPendingFile(file);
        setDialogOpen(true);
      } else {
        addFile(file);
      }
    }
  };

  const addFile = (file) => {
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [f.name, f]));
      map.set(file.name, { file, name: file.name, status: "pending", fromDb: false });
      return Array.from(map.values());
    });
  };

  const handleConfirmReplace = () => {
    addFile(pendingFile);
    setPendingFile(null);
    setDialogOpen(false);
  };

  // --------------------------------------------------
  // UPLOAD + INGEST
  // --------------------------------------------------
  const handleUpload = async () => {
    setUploading(true);
    for (const item of files) {
      if (item.status !== "pending") continue;
      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("projectId", project.id);
        const res = await fetch("/api/files/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        setFiles((prev) =>
          prev.map((f) => f.name === item.name ? { ...f, status: "indexed", fromDb: true } : f)
        );
      } catch (err) {
        console.error(err);
        setFiles((prev) =>
          prev.map((f) => f.name === item.name ? { ...f, status: "error" } : f)
        );
      }
    }
    setUploading(false);
  };

  // --------------------------------------------------
  // DELETE DOCUMENT
  // --------------------------------------------------
  const requestDeleteFile = (file) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    await fetch(`/api/files/${fileToDelete.id}`, { method: "DELETE" });
    setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
    setFileToDelete(null);
    setDeleteDialogOpen(false);
  };

  const cancelDeleteFile = () => {
    setFileToDelete(null);
    setDeleteDialogOpen(false);
  };

  // --------------------------------------------------
  // ADD DATA SOURCE
  // --------------------------------------------------
  const handleAddSource = async (sourceData) => {
    setConnecting(true);
    try {
      if (sourceData.type === "excel_local") {
        const formData = new FormData();
        formData.append("file", sourceData._file);
        formData.append("projectId", project.id);
        formData.append("label", sourceData.label || sourceData._file.name);
        const res = await fetch("/api/sources/upload-excel", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || "Failed to upload Excel file.");
          return;
        }
        await fetchSources();
        return;
      }

      const res = await fetch("/api/sources/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, ...sourceData }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to connect source.");
        return;
      }

      const data = await res.json();
      if (data.skipped_tabs?.length > 0) {
        alert(
          `Source connected, but these tab(s) were skipped:\n\n` +
          data.skipped_tabs.map(t => `• "${t}"`).join("\n")
        );
      }
      await fetchSources();
    } catch (err) {
      console.error("Add source error:", err);
      alert("Something went wrong connecting the source.");
    } finally {
      setConnecting(false);
    }
  };

  // --------------------------------------------------
  // RELOAD / REUPLOAD / DELETE SOURCE
  // --------------------------------------------------
  const handleReloadSource = async (id) => {
    await fetch(`/api/sources/sync/${id}`, { method: "POST" });
    await fetchSources();
  };

  const handleReuploadExcel = async (sourceId, label, file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", project.id);
    formData.append("label", label);
    formData.append("source_id", sourceId);
    const res = await fetch("/api/sources/upload-excel", { method: "POST", body: formData });
    if (!res.ok) { alert("Re-upload failed."); return; }
    await fetchSources();
  };

  const handleDeleteSource = async (id) => {
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    await fetchSources();
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="space-y-6">

      {/* Project header */}
      <div className="flex items-center gap-3">
        {project.logo_url && (
          <img
            src={project.logo_url}
            alt={project.name}
            className="h-10 w-10 object-contain rounded-lg border p-0.5"
          />
        )}
        <h1 className="text-2xl font-semibold">{project.name}</h1>
      </div>

      {/* Tab bar + domain dropdown on the right */}
      <div className="flex items-center justify-between border-b pb-2 gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <TabButton active={activeTab === "documents"} onClick={() => setActiveTab("documents")}>Documents</TabButton>
          <TabButton active={activeTab === "chat"} onClick={() => setActiveTab("chat")}>Chat</TabButton>
          <TabButton active={activeTab === "integrations"} onClick={() => setActiveTab("integrations")}>Integrations</TabButton>
          <TabButton active={activeTab === "leads"} onClick={() => setActiveTab("leads")}>Leads</TabButton>
          <TabButton active={activeTab === "flows"} onClick={() => setActiveTab("flows")}>Flows</TabButton>
          <TabButton active={activeTab === "conversations"} onClick={() => setActiveTab("conversations")}>Conversations</TabButton>
          <TabButton active={activeTab === "analytics"} onClick={() => setActiveTab("analytics")}>Analytics</TabButton>
          <TabButton active={activeTab === "api"} onClick={() => setActiveTab("api")}>API</TabButton>

        </div>

        {/* Domain selector — auto-saves on change */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={domain}
            onChange={(e) => handleDomainChange(e.target.value)}
            disabled={savingDomain}
            className="border rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-700 disabled:opacity-60 cursor-pointer"
          >
            <option value="">No domain</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {savingDomain && <span className="text-xs text-muted-foreground">Saving...</span>}
          {domainSaved && <span className="text-xs text-emerald-600 font-medium">✓ Saved</span>}
        </div>
      </div>

      {activeTab === "documents" && (
        <DocumentsTab
          files={files}
          onSelectFiles={handleSelectFiles}
          onUpload={handleUpload}
          uploading={uploading}
          onDeleteFile={requestDeleteFile}
          onAddSource={handleAddSource}
          connecting={connecting}
          sources={sources}
          onReload={handleReloadSource}
          onDeleteSource={handleDeleteSource}
          onReuploadExcel={handleReuploadExcel}
        />
      )}

      {activeTab === "chat" && <ChatTab projectId={project.id} />}
      {activeTab === "integrations" && <IntegrationsTab projectId={project.id} />}
      {activeTab === "leads" && <LeadsTab project={project.id} />}
      {activeTab === "flows" && <FlowsTab projectId={project.id} />}
      {activeTab === "conversations" && <ConversationsTab projectId={project.id} />}
      {activeTab === "analytics" && <AnalyticsTab project={project.id} />}
      {activeTab === "api" && <ApiKeysTab project={project} />}



      <AppAlertDialog
        open={dialogOpen}
        title="Replace file?"
        description={<><strong>{pendingFile?.name}</strong> already exists. Replacing will overwrite it.</>}
        confirmText="Replace"
        cancelText="Cancel"
        onConfirm={handleConfirmReplace}
        onCancel={() => setDialogOpen(false)}
      />

      <AppAlertDialog
        open={deleteDialogOpen}
        title="Delete document?"
        description={<><strong>{fileToDelete?.name}</strong> will be permanently deleted, including all indexed chunks.</>}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteFile}
        onCancel={cancelDeleteFile}
      />
    </div>
  );
}

function TabButton({ active, children, ...props }) {
  return (
    <Button variant={active ? "default" : "ghost"} size="sm" {...props}>
      {children}
    </Button>
  );
}