"use client";

import { useEffect, useState } from "react";
import DocumentsTab from "./DocumentsTab";
import IntegrationsTab from "./IntegrationsTab";
import LeadsTab from "./LeadsTab";
import ChatTab from "./ChatTab";
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

  // replace-file dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  // delete-file dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  // --------------------------------------------------
  // LOAD FILES (API ONLY)
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
  // FILE SELECTION
  // --------------------------------------------------
  const handleSelectFiles = (selectedFiles) => {
    for (const file of selectedFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) continue;

      const exists = files.find(
        (f) => f.name === file.name && f.fromDb
      );

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
      map.set(file.name, {
        file,
        name: file.name,
        status: "pending",
        fromDb: false,
      });
      return Array.from(map.values());
    });
  };

  const handleConfirmReplace = () => {
    addFile(pendingFile);
    setPendingFile(null);
    setDialogOpen(false);
  };

  // --------------------------------------------------
  // UPLOAD + INGEST (API ONLY)
  // --------------------------------------------------
  const handleUpload = async () => {
    setUploading(true);

    for (const item of files) {
      if (item.status !== "pending") continue;

      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("projectId", project.id);

        const res = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");

        setFiles((prev) =>
          prev.map((f) =>
            f.name === item.name
              ? { ...f, status: "indexed", fromDb: true }
              : f
          )
        );
      } catch (err) {
        console.error(err);
        setFiles((prev) =>
          prev.map((f) =>
            f.name === item.name ? { ...f, status: "error" } : f
          )
        );
      }
    }

    setUploading(false);
  };

  // --------------------------------------------------
  // DELETE DOCUMENT (API ONLY)
  // --------------------------------------------------
  const requestDeleteFile = (file) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;

    await fetch(`/api/files/${fileToDelete.id}`, {
      method: "DELETE",
    });

    setFiles((prev) =>
      prev.filter((f) => f.id !== fileToDelete.id)
    );

    setFileToDelete(null);
    setDeleteDialogOpen(false);
  };

  const cancelDeleteFile = () => {
    setFileToDelete(null);
    setDeleteDialogOpen(false);
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{project.name}</h1>

      <div className="flex gap-2 border-b pb-2">
        <TabButton
          active={activeTab === "documents"}
          onClick={() => setActiveTab("documents")}
        >
          Documents
        </TabButton>
        <TabButton
          active={activeTab === "chat"}
          onClick={() => setActiveTab("chat")}
        >
          Chat
        </TabButton>
        <TabButton
          active={activeTab === "integrations"}
          onClick={() => setActiveTab("integrations")}
        >
          Integrations
        </TabButton>
        <TabButton
          active={activeTab === "leads"}
          onClick={() => setActiveTab("leads")}
        >
          Leads
        </TabButton>
      </div>

      {activeTab === "documents" && (
        <DocumentsTab
          files={files}
          onSelectFiles={handleSelectFiles}
          onUpload={handleUpload}
          uploading={uploading}
          onDeleteFile={requestDeleteFile}
        />
      )}

      {activeTab === "chat" && <ChatTab projectId={project.id} />}
      {activeTab === "integrations" && (
        <IntegrationsTab projectId={project.id} />
      )}
      {activeTab === "leads" && <LeadsTab project={project} />}

      {/* Replace file dialog */}
      <AppAlertDialog
        open={dialogOpen}
        title="Replace file?"
        description={
          <>
            <strong>{pendingFile?.name}</strong> already exists.
            Replacing will overwrite it.
          </>
        }
        confirmText="Replace"
        cancelText="Cancel"
        onConfirm={handleConfirmReplace}
        onCancel={() => setDialogOpen(false)}
      />

      {/* Delete file dialog */}
      <AppAlertDialog
        open={deleteDialogOpen}
        title="Delete document?"
        description={
          <>
            <strong>{fileToDelete?.name}</strong> will be permanently
            deleted, including all indexed chunks.
          </>
        }
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
