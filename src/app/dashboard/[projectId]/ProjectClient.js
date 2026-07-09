// src/app/dashboard/[projectId]/ProjectClient.js

"use client";

import { useEffect, useState } from "react";
import DocumentsTab from "./DocumentsTab";
import IntegrationsTab from "./IntegrationsTab";
import LeadsTab from "./LeadsTab";
import FlowsTab from "./FlowsTab";
import ConversationsTab from "./ConversationsTab";
import AnalyticsTab from "./AnalyticsTab";
import ApiKeysTab from "./ApiKeysTab";
import CampaignsTab from "./CampaignsTab";
import TemplateLibrary from "./TemplateLibrary";
import ShopTab from "./ShopTab";
import AppointmentsTab from "./AppointmentsTab";
import EventsTab from "./EventsTab";
import TeamTab from "./TeamTab";

import { Button } from "@/components/ui/button";
import AppAlertDialog from "@/components/alertdialog";
import {
  FileText, Plug, Users, GitBranch,
  Inbox, BarChart2, Key, Megaphone, Sparkles, ShoppingBag, CalendarDays, CalendarRange, UserCog
} from "lucide-react";

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
  // Agents only get Conversations + Leads — everything else (sources,
  // flows, billing-adjacent settings, team management) is owner/admin only.
  const myRole = project.myRole || "owner";
  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin";

  const [activeTab, setActiveTab] = useState(isOwnerOrAdmin ? "documents" : "conversations");
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

      <div className="flex gap-6 items-start">
        {/* ── Vertical tab sidebar ── */}
        <nav className="w-56 shrink-0 space-y-4">
          {/* Domain selector — auto-saves on change. Settings, owner/admin only. */}
          {isOwnerOrAdmin && (
            <div className="space-y-1">
              <select
                value={domain}
                onChange={(e) => handleDomainChange(e.target.value)}
                disabled={savingDomain}
                className="w-full border rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-700 disabled:opacity-60 cursor-pointer"
              >
                <option value="">No domain</option>
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {savingDomain && <span className="text-xs text-muted-foreground">Saving...</span>}
              {domainSaved && <span className="text-xs text-emerald-600 font-medium">✓ Saved</span>}
            </div>
          )}

          <div className="flex flex-col gap-1 border-r pr-3">
            {isOwnerOrAdmin && (
              <TabButton active={activeTab === "documents"} onClick={() => setActiveTab("documents")}>
                <FileText size={13} />Documents
              </TabButton>
            )}
            {isOwnerOrAdmin && (
              <TabButton active={activeTab === "integrations"} onClick={() => setActiveTab("integrations")}>
                <Plug size={13} />Integrations
              </TabButton>
            )}
            <TabButton active={activeTab === "leads"} onClick={() => setActiveTab("leads")}>
              <Users size={13} />Leads
            </TabButton>
            {isOwnerOrAdmin && (
              <TabButton active={activeTab === "flows"} onClick={() => setActiveTab("flows")}>
                <GitBranch size={13} />Flows
              </TabButton>
            )}
            <TabButton active={activeTab === "conversations"} onClick={() => setActiveTab("conversations")}>
              <Inbox size={13} />Conversations
            </TabButton>
            {isOwnerOrAdmin && (
              <TabButton active={activeTab === "analytics"} onClick={() => setActiveTab("analytics")}>
                <BarChart2 size={13} />Analytics
              </TabButton>
            )}
            {isOwnerOrAdmin && (
              <TabButton active={activeTab === "api"} onClick={() => setActiveTab("api")}>
                <Key size={13} />API
              </TabButton>
            )}
            {isOwnerOrAdmin && (
              <TabButton active={activeTab === "campaigns"} onClick={() => setActiveTab("campaigns")}>
                <Megaphone size={13} />Campaigns
              </TabButton>
            )}
            {isOwnerOrAdmin && (
              <TabButton active={activeTab === "templates"} onClick={() => setActiveTab("templates")}>
                <Sparkles size={13} />Templates
              </TabButton>
            )}
            {isOwnerOrAdmin && (
              <TabButton active={activeTab === "shop"} onClick={() => setActiveTab("shop")}>
                <ShoppingBag size={13} />Shop
              </TabButton>
            )}
            {isOwnerOrAdmin && (
              <TabButton active={activeTab === "appointments"} onClick={() => setActiveTab("appointments")}>
                <CalendarDays size={13} />Appointments
              </TabButton>
            )}
            {isOwnerOrAdmin && (
              <TabButton active={activeTab === "events"} onClick={() => setActiveTab("events")}>
                <CalendarRange size={13} />Events
              </TabButton>
            )}
            {isOwnerOrAdmin && (
              <TabButton active={activeTab === "team"} onClick={() => setActiveTab("team")}>
                <UserCog size={13} />Team
              </TabButton>
            )}
          </div>
        </nav>

        {/* ── Tab content ── */}
        <div className="flex-1 min-w-0">
          {isOwnerOrAdmin && activeTab === "documents" && (
            <DocumentsTab
              projectId={project.id}
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

          {isOwnerOrAdmin && activeTab === "integrations" && <IntegrationsTab projectId={project.id} />}
          {activeTab === "leads" && <LeadsTab project={project.id} />}
          {isOwnerOrAdmin && activeTab === "flows" && <FlowsTab projectId={project.id} />}
          {activeTab === "conversations" && <ConversationsTab projectId={project.id} />}
          {isOwnerOrAdmin && activeTab === "analytics" && <AnalyticsTab project={project} />}
          {isOwnerOrAdmin && activeTab === "api" && <ApiKeysTab project={project} />}
          {isOwnerOrAdmin && activeTab === "campaigns" && (
            <CampaignsTab project={project} onOpenTemplateLibrary={() => setActiveTab("templates")} />
          )}
          {isOwnerOrAdmin && activeTab === "templates" && <TemplateLibrary projectId={project.id} />}
          {isOwnerOrAdmin && activeTab === "shop" && <ShopTab project={project} />}
          {isOwnerOrAdmin && activeTab === "appointments" && <AppointmentsTab project={project} />}
          {isOwnerOrAdmin && activeTab === "events" && <EventsTab project={project} />}
          {isOwnerOrAdmin && activeTab === "team" && <TeamTab project={project} />}
        </div>
      </div>

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
    <Button
      variant={active ? "default" : "ghost"}
      size="sm"
      className="flex items-center gap-2 justify-start w-full"
      {...props}
    >
      {children}
    </Button>
  );
}