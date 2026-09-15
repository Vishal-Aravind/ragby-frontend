"use client";

import { useEffect, useState } from "react";
import DocumentsTab from "./DocumentsTab";
import AppAlertDialog from "@/components/alertdialog";
import { supabase } from "@/lib/supabase";
import { MAX_DOCUMENT_BYTES } from "@/lib/safe-filename";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];

const ALLOWED_EXTENSIONS = ["pdf", "docx", "ppt", "pptx", "xls", "xlsx", "txt"];
const MAX_DOCUMENT_MB = MAX_DOCUMENT_BYTES / 1024 / 1024;

// Documents is the one tab whose data layer used to live in the shared
// ProjectClient shell instead of the tab itself — genuinely tab-specific,
// so it moves here rather than into DashboardShell.
export default function DocumentsPageClient({ projectId }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

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
    if (!projectId) return;
    const loadFiles = async () => {
      const res = await fetch(`/api/files?projectId=${projectId}`);
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
  }, [projectId]);

  // --------------------------------------------------
  // LOAD SOURCES
  // --------------------------------------------------
  const fetchSources = async () => {
    const res = await fetch(`/api/sources?project_id=${projectId}`);
    if (!res.ok) return;
    const data = await res.json();
    setSources(data || []);
  };

  useEffect(() => {
    if (!projectId) return;
    fetchSources();
  }, [projectId]);

  // --------------------------------------------------
  // FILE SELECTION
  // --------------------------------------------------
  const handleSelectFiles = (selectedFiles) => {
    const rejected = [];
    const tooLarge = [];
    for (const file of selectedFiles) {
      // Browser-reported MIME is unreliable (a .docx often arrives as
      // application/octet-stream), so fall back to the extension rather
      // than silently dropping a file the server would have accepted.
      const ext = file.name.toLowerCase().split(".").pop();
      if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
        rejected.push(file.name);
        continue;
      }
      // Purely a fast, friendly rejection — the file's bytes go straight
      // to Storage now (see handleUpload), so this browser-side check
      // can't be trusted as the real limit. The bucket's own file size
      // limit is what actually enforces it.
      if (file.size > MAX_DOCUMENT_BYTES) {
        tooLarge.push(file.name);
        continue;
      }
      const exists = files.find((f) => f.name === file.name && f.fromDb);
      if (exists) {
        setPendingFile(file);
        setDialogOpen(true);
      } else {
        addFile(file);
      }
    }
    const messages = [];
    if (rejected.length) {
      messages.push(`Skipped ${rejected.join(", ")} — only PDF, Word, PowerPoint, Excel and text files are supported.`);
    }
    if (tooLarge.length) {
      messages.push(`Skipped ${tooLarge.join(", ")} — the limit is ${MAX_DOCUMENT_MB}MB per file.`);
    }
    setUploadError(messages.length ? messages.join(" ") : null
    );
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
    setUploadError(null);
    for (const item of files) {
      if (item.status !== "pending") continue;
      try {
        // Step 1: ask our server for a short-lived signed URL. This
        // request is tiny (a filename, not a file) — it never hits
        // Vercel's per-function body limit.
        const urlRes = await fetch("/api/files/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, filename: item.name }),
        });
        const urlData = await urlRes.json().catch(() => ({}));
        if (!urlRes.ok) {
          setFiles((prev) =>
            prev.map((f) => f.name === item.name ? { ...f, status: "error", fromDb: true } : f)
          );
          setUploadError(urlData.error || "Some files couldn't be uploaded.");
          continue;
        }

        // Step 2: the actual bytes go straight from this browser to
        // Supabase Storage, bypassing our server (and its size limit)
        // entirely.
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .uploadToSignedUrl(urlData.path, urlData.token, item.file);
        if (uploadError) {
          setFiles((prev) =>
            prev.map((f) => f.name === item.name ? { ...f, status: "error", fromDb: true } : f)
          );
          setUploadError(
            /exceeded the maximum allowed size/i.test(uploadError.message || "")
              ? `${item.name} is too large for the ${MAX_DOCUMENT_MB}MB limit.`
              : "Some files couldn't be uploaded."
          );
          continue;
        }

        // Step 3: tell our server the upload landed, so it can record it
        // and kick off ingestion.
        const res = await fetch("/api/files/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, filename: item.name }),
        });
        const data = await res.json().catch(() => ({}));
        // The route used to answer {success:true} even when ingestion had
        // failed, so every file showed as "Indexed" whether or not the bot
        // could actually read it. Trust the reported status, not the upload.
        if (!res.ok || data.success === false) {
          setFiles((prev) =>
            prev.map((f) => f.name === item.name ? { ...f, status: "error", fromDb: true } : f)
          );
          setUploadError(data.error || "Some files couldn't be processed.");
          continue;
        }
        setFiles((prev) =>
          prev.map((f) => f.name === item.name ? { ...f, status: "indexed", fromDb: true } : f)
        );
      } catch (err) {
        console.error(err);
        setFiles((prev) =>
          prev.map((f) => f.name === item.name ? { ...f, status: "error" } : f)
        );
        setUploadError("Some files couldn't be uploaded.");
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
    const res = await fetch(`/api/files/${fileToDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
    } else {
      // Removing it from the list on failure hid the fact that the document
      // was still indexed and still being cited by the bot.
      setUploadError("Couldn't delete that document. Please try again.");
    }
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
        formData.append("projectId", projectId);
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
        body: JSON.stringify({ projectId, ...sourceData }),
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
    const res = await fetch(`/api/sources/sync/${id}`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed to refresh this source.");
    }
    await fetchSources();
  };

  const handleReuploadExcel = async (sourceId, label, file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", projectId);
    formData.append("label", label);
    formData.append("source_id", sourceId);
    const res = await fetch("/api/sources/upload-excel", { method: "POST", body: formData });
    if (!res.ok) { alert("Re-upload failed."); return; }
    await fetchSources();
  };

  const handleDeleteSource = async (id) => {
    const res = await fetch(`/api/sources/${id}`, { method: "DELETE" });
    if (!res.ok) alert("Couldn't disconnect that source. Please try again.");
    await fetchSources();
  };

  return (
    <>
      {uploadError && (
        <div className="mx-6 mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {uploadError}
        </div>
      )}

      <DocumentsTab
        projectId={projectId}
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
    </>
  );
}
