//[projectId]/ProjectClient.js

"use client";

import { useEffect, useState } from "react";
import DocumentsTab from "./DocumentsTab";
import IntegrationsTab from "./IntegrationsTab";
import LeadsTab from "./LeadsTab";
import ChatTab from "./ChatTab";
import SettingsTab from "./SettingsTab";
import { Button } from "@/components/ui/button";
import AppAlertDialog from "@/components/alertdialog";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
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
  // FIX: No manual token — cookies are forwarded automatically by the browser.
  // The Next.js API route (app/api/sources/route.js) reads the session from
  // cookies via getSupabase(req), so no Authorization header needed here.
  // --------------------------------------------------
  const fetchSources = async () => {
    const res = await fetch(`/api/sources?project_id=${project.id}`);
    if (!res.ok) {
      console.error("Failed to fetch sources:", res.status);
      return;
    }
    const data = await res.json();
    console.log("sources data:", data);
    setSources(data || []);
  };

  useEffect(() => {
    if (!project?.id) return;
    fetchSources();
  }, [project.id]);

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
  // No manual token — cookies handle auth automatically
  // --------------------------------------------------

  const handleAddSource = async (sourceData) => {
    setConnecting(true);
    try {
      // ── Local Excel — multipart upload ──────────────────
      if (sourceData.type === "excel_local") {
        const formData = new FormData();
        formData.append("file", sourceData._file);
        formData.append("projectId", project.id);
        formData.append("label", sourceData.label || sourceData._file.name);

        const res = await fetch("/api/sources/upload-excel", {
          method: "POST",
          body: formData,
          // No Content-Type header — browser sets it with boundary automatically
        });

        if (!res.ok) {
          const err = await res.json();
          alert(err.error || "Failed to upload Excel file.");
          return;
        }

        await fetchSources();
        return;
      }

      // ── All other sources — JSON POST ────────────────────
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

      // Show warning if any sheet tabs were skipped
      if (data.skipped_tabs?.length > 0) {
        alert(
          `Source connected, but these tab(s) were not found and were skipped:\n\n` +
          data.skipped_tabs.map(t => `• "${t}"`).join("\n") +
          `\n\nPlease check the tab names and reload the source.`
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
  // RELOAD SOURCE
  // --------------------------------------------------
  const handleReloadSource = async (id) => {
    await fetch(`/api/sources/sync/${id}`, { method: "POST" });
    await fetchSources();
  };

  // --------------------------------------------------
  // REUPLOAD EXCEL
  // --------------------------------------------------
  const handleReuploadExcel = async (sourceId, label, file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", project.id);
    formData.append("label", label);
    formData.append("source_id", sourceId);
  
    const res = await fetch("/api/sources/upload-excel", {
      method: "POST",
      body: formData,
    });
  
    if (!res.ok) {
      alert("Re-upload failed.");
      return;
    }
  
    await fetchSources();
  };

  // --------------------------------------------------
  // DELETE SOURCE
  // --------------------------------------------------
  const handleDeleteSource = async (id) => {
    await fetch(`/api/sources/${id}`, { method: "DELETE" });
    await fetchSources();
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{project.name}</h1>

      <div className="flex gap-2 border-b pb-2">
        <TabButton active={activeTab === "documents"} onClick={() => setActiveTab("documents")}>Documents</TabButton>
        <TabButton active={activeTab === "chat"} onClick={() => setActiveTab("chat")}>Chat</TabButton>
        <TabButton active={activeTab === "integrations"} onClick={() => setActiveTab("integrations")}>Integrations</TabButton>
        <TabButton active={activeTab === "leads"} onClick={() => setActiveTab("leads")}>Leads</TabButton>
        <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")}>Settings</TabButton>
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
      {activeTab === "leads" && <LeadsTab project={project} />}
      {activeTab === "settings" && (
        <SettingsTab
          project={project}
          onUpdate={async (data) => {
            await fetch(`/api/projects/${project.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
          }}
        />
      )}

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

