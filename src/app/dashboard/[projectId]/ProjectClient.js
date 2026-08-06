// src/app/dashboard/[projectId]/ProjectClient.js

"use client";

import { useEffect, useMemo, useState } from "react";
import { Joyride, STATUS } from "react-joyride";
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

// Guided tour copy — kept short and benefit-oriented on purpose (covers the
// tabs needed to get a bot live, not every tab) rather than a step per tab.
// Praised onboarding tours (Linear, Notion) teach a handful of high-value
// things at high attention; touring all 13 tabs on first login reads as
// "features dumped on users," which the research consistently flags as the
// difference between a tour people finish and one they skip.
const TOUR_STEPS = [
  {
    target: "body",
    placement: "center",
    title: "Welcome to Zavo 👋",
    content: "Let's take a 60-second look around your dashboard.",
    access: null,
  },
  {
    target: '[data-tour="tab-documents"]',
    title: "Documents",
    content: "This is where your bot learns — connect a website, PDF, spreadsheet, or your Shopify catalog.",
    access: "documents",
  },
  {
    target: '[data-tour="tab-integrations"]',
    title: "Integrations",
    content: "Go live by connecting WhatsApp, Slack, Telegram, or Shopify here.",
    access: "integrations",
  },
  {
    target: '[data-tour="tab-flows"]',
    title: "Flows",
    content: "Build automated conversation flows — no code needed.",
    access: "flows",
  },
  {
    target: '[data-tour="tab-shop"]',
    title: "Shop",
    content: "Sell products and take orders directly inside chat.",
    access: "shop",
  },
  {
    target: '[data-tour="tab-conversations"]',
    title: "Conversations",
    content: "Every real customer conversation lands here — reply anytime.",
    access: null,
  },
  {
    target: '[data-tour="tab-analytics"]',
    title: "Analytics",
    content: "Track usage and see what your bot couldn't answer.",
    access: "analytics",
  },
  {
    target: "body",
    placement: "center",
    title: "That's the tour!",
    content: "Click ✨ Tour anytime to see it again.",
    access: null,
  },
];

const TOUR_STYLES = {
  options: {
    primaryColor: "oklch(0.205 0 0)",
    backgroundColor: "oklch(1 0 0)",
    arrowColor: "oklch(1 0 0)",
    textColor: "oklch(0.145 0 0)",
    overlayColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: 12,
    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.18)",
  },
  tooltipTitle: {
    fontWeight: 600,
    marginBottom: 4,
  },
  buttonNext: {
    borderRadius: 8,
    padding: "8px 14px",
  },
  buttonBack: {
    color: "oklch(0.45 0 0)",
  },
  buttonSkip: {
    color: "oklch(0.55 0 0)",
  },
};

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
  // Agents only get Conversations + Leads by default — everything else
  // (sources, flows, billing-adjacent settings) is owner/admin only,
  // UNLESS an owner/admin has granted a specific agent extra tabs via
  // custom permissions (Team tab). Team management itself is never
  // grantable this way — only owner/admin can touch it.
  const myRole = project.myRole || "owner";
  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin";
  const myPermissions = project.myPermissions || [];
  const hasAccess = (tab) => isOwnerOrAdmin || myPermissions.includes(tab);

  const [activeTab, setActiveTab] = useState(hasAccess("documents") ? "documents" : "conversations");

  // --------------------------------------------------
  // GUIDED TOUR
  // --------------------------------------------------
  // Steps are filtered by hasAccess so an agent with only Conversations+
  // Leads gets a short tour, not one pointing at tabs they can't see.
  const tourSteps = useMemo(
    () => TOUR_STEPS.filter((s) => !s.access || hasAccess(s.access)),
    [myPermissions, isOwnerOrAdmin]
  );
  const [runTour, setRunTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
  const tourSeenKey = `zavo_tour_seen_${project.id}_${myRole}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(tourSeenKey)) return;
    // Short delay so the tab panel has actually rendered before the first
    // spotlight target is measured — an instant tour on mount can spotlight
    // the wrong position if layout hasn't settled yet.
    const timer = setTimeout(() => setRunTour(true), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourSeenKey]);

  const handleTourCallback = (data) => {
    const { status, index, action, type } = data;
    if (type === "step:after" || type === "target:notFound") {
      setTourStepIndex(index + (action === "prev" ? -1 : 1));
    }
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
      setTourStepIndex(0);
      window.localStorage.setItem(tourSeenKey, "1");
    }
  };

  const restartTour = () => {
    setTourStepIndex(0);
    setRunTour(true);
  };
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

      <Joyride
        steps={tourSteps}
        run={runTour}
        stepIndex={tourStepIndex}
        continuous
        showProgress
        showSkipButton
        disableScrolling={false}
        callback={handleTourCallback}
        styles={TOUR_STYLES}
      />

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
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={restartTour}>
          <Sparkles size={13} />Tour
        </Button>
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
            {hasAccess("documents") && (
              <TabButton data-tour="tab-documents" active={activeTab === "documents"} onClick={() => setActiveTab("documents")}>
                <FileText size={13} />Documents
              </TabButton>
            )}
            {hasAccess("integrations") && (
              <TabButton data-tour="tab-integrations" active={activeTab === "integrations"} onClick={() => setActiveTab("integrations")}>
                <Plug size={13} />Integrations
              </TabButton>
            )}
            <TabButton active={activeTab === "leads"} onClick={() => setActiveTab("leads")}>
              <Users size={13} />Leads
            </TabButton>
            {hasAccess("flows") && (
              <TabButton data-tour="tab-flows" active={activeTab === "flows"} onClick={() => setActiveTab("flows")}>
                <GitBranch size={13} />Flows
              </TabButton>
            )}
            <TabButton data-tour="tab-conversations" active={activeTab === "conversations"} onClick={() => setActiveTab("conversations")}>
              <Inbox size={13} />Conversations
            </TabButton>
            {hasAccess("analytics") && (
              <TabButton data-tour="tab-analytics" active={activeTab === "analytics"} onClick={() => setActiveTab("analytics")}>
                <BarChart2 size={13} />Analytics
              </TabButton>
            )}
            {hasAccess("api") && (
              <TabButton active={activeTab === "api"} onClick={() => setActiveTab("api")}>
                <Key size={13} />API
              </TabButton>
            )}
            {hasAccess("campaigns") && (
              <TabButton active={activeTab === "campaigns"} onClick={() => setActiveTab("campaigns")}>
                <Megaphone size={13} />Campaigns
              </TabButton>
            )}
            {hasAccess("templates") && (
              <TabButton active={activeTab === "templates"} onClick={() => setActiveTab("templates")}>
                <Sparkles size={13} />Templates
              </TabButton>
            )}
            {hasAccess("shop") && (
              <TabButton data-tour="tab-shop" active={activeTab === "shop"} onClick={() => setActiveTab("shop")}>
                <ShoppingBag size={13} />Shop
              </TabButton>
            )}
            {hasAccess("appointments") && (
              <TabButton active={activeTab === "appointments"} onClick={() => setActiveTab("appointments")}>
                <CalendarDays size={13} />Appointments
              </TabButton>
            )}
            {hasAccess("events") && (
              <TabButton active={activeTab === "events"} onClick={() => setActiveTab("events")}>
                <CalendarRange size={13} />Registrations
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
          {hasAccess("documents") && activeTab === "documents" && (
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

          {hasAccess("integrations") && activeTab === "integrations" && <IntegrationsTab projectId={project.id} />}
          {activeTab === "leads" && <LeadsTab project={project.id} />}
          {hasAccess("flows") && activeTab === "flows" && <FlowsTab projectId={project.id} />}
          {activeTab === "conversations" && <ConversationsTab projectId={project.id} />}
          {hasAccess("analytics") && activeTab === "analytics" && <AnalyticsTab project={project} />}
          {hasAccess("api") && activeTab === "api" && <ApiKeysTab project={project} />}
          {hasAccess("campaigns") && activeTab === "campaigns" && (
            <CampaignsTab project={project} onOpenTemplateLibrary={() => setActiveTab("templates")} />
          )}
          {hasAccess("templates") && activeTab === "templates" && <TemplateLibrary projectId={project.id} />}
          {hasAccess("shop") && activeTab === "shop" && <ShopTab project={project} />}
          {hasAccess("appointments") && activeTab === "appointments" && <AppointmentsTab project={project} />}
          {hasAccess("events") && activeTab === "events" && <EventsTab project={project} />}
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