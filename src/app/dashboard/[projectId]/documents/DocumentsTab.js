"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Trash2, ChevronDown, ChevronRight, Loader2, FileText, Globe, Database, Table, Sheet, RefreshCw, MessageCircle, X, NotepadText } from "lucide-react";
import AppAlertDialog from "@/components/alertdialog";
import ChatTab from "./ChatTab";

const SOURCE_TABS = [
  { id: "documents", label: "Documents", icon: FileText },
  { id: "text",     label: "Text", icon: NotepadText },
  { id: "gsheet",   label: "Google Sheets", icon: Sheet },
  { id: "excel",    label: "Excel", icon: Table },
  { id: "website",  label: "Website", icon: Globe },
  { id: "database", label: "Database", icon: Database },
];

const MAX_TEXT_CHARS = 20000;

// File size (MB) is the metric a merchant can actually judge before
// uploading, unlike "chunks" or "pages" — no comparable product (Chatbase,
// Voiceflow, Intercom Fin) surfaces a page/chunk count as its user-facing
// limit, they all gate on file size instead. maxFileMB is the real,
// plan-tiered number (see backend/config.py's PLAN_LIMITS) — a function of
// it, not a static object, since the number differs by plan and is fetched
// at runtime. The row-based sheet limit stays as-is: a Google Sheet has no
// file-size concept the user perceives directly.
function getCapHints(maxFileMB) {
  return {
    documents: `Files up to ${maxFileMB}MB are supported — for larger files, split into multiple uploads.`,
    gsheet: "Up to 5,000 rows are indexed per sheet, across all tabs read.",
    excel: `Files up to ${maxFileMB}MB are supported — for larger spreadsheets, split into multiple files and upload each as its own source.`,
    website: "Very large sites may only get partial coverage — check back after a crawl to confirm everything you need was indexed.",
  };
}

export default function DocumentsTab({
  projectId,
  files,
  maxFileMB,
  onSelectFiles,
  onRetryErrors,
  onAddText,
  uploading,
  onDeleteFile,
  onEditFile,
  onAddSource,
  connecting,
  sources,
  onReload,
  onDeleteSource,
  onReuploadExcel,
}) {
  const [type, setType] = useState("documents");
  const [showChat, setShowChat] = useState(false);
  const capHints = getCapHints(maxFileMB);

  // ── Raw text state ────────────────────────────────────
  const [textLabel, setTextLabel] = useState("");
  const [textContent, setTextContent] = useState("");
  const [savingText, setSavingText] = useState(false);

  async function handleSaveText() {
    if (!textContent.trim()) return;
    setSavingText(true);
    try {
      await onAddText(textLabel, textContent);
      setTextLabel("");
      setTextContent("");
    } finally {
      setSavingText(false);
    }
  }

  // ── Documents state ──────────────────────────────────
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length) onSelectFiles(selected);
  };

  // ── Google Sheets state ──────────────────────────────
  const [sheetLabel, setSheetLabel]   = useState("");
  const [gsheetUrl, setGsheetUrl]     = useState("");
  // A list of typed-and-committed tab names, not a single comma-separated
  // string — a real Google Sheets tab name can itself contain a comma
  // ("Q1, Actuals"), so splitting on "," could never select it correctly.
  // Each name is committed with Enter, same pattern as an email chip input.
  const [sheetTabs, setSheetTabs]     = useState([]);
  const [sheetTabDraft, setSheetTabDraft] = useState("");
  const [readAll, setReadAll]         = useState(false);

  function commitSheetTabDraft() {
    const name = sheetTabDraft.trim();
    if (name && !sheetTabs.includes(name)) setSheetTabs(prev => [...prev, name]);
    setSheetTabDraft("");
  }
  function removeSheetTab(name) {
    setSheetTabs(prev => prev.filter(t => t !== name));
  }

  // ── Excel state ──────────────────────────────────────
  const [excelLabel, setExcelLabel]   = useState("");
  const [excelFile, setExcelFile]     = useState(null);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [reuploadingId, setReuploadingId]   = useState(null);

  // ── Website state ─────────────────────────────────────
  const [websiteLabel, setWebsiteLabel] = useState("");
  const [websiteUrl, setWebsiteUrl]     = useState("");
  const [fullSite, setFullSite]         = useState(true);
  const [maxPages, setMaxPages]         = useState(30);

  // ── Database state ───────────────────────────────────
  const [dbLabel, setDbLabel]         = useState("");
  const [dbUrl, setDbUrl]             = useState("");
  const [introspecting, setIntrospecting] = useState(false);
  const [schema, setSchema]           = useState(null);
  const [allowed, setAllowed]         = useState({});
  const [expanded, setExpanded]       = useState({});

  // ── Delete source dialog ─────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete]     = useState(null);

  // ── Introspect DB ────────────────────────────────────
  async function handleIntrospect() {
    if (!dbUrl.trim()) return;
    setIntrospecting(true);
    setSchema(null);
    setAllowed({});
    const res = await fetch("/api/sources/introspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ db_url: dbUrl, projectId }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.detail || err.error || "Could not connect. Check your database URL.");
      setIntrospecting(false);
      return;
    }
    const data = await res.json();
    setSchema(data.schema);
    const initial = {};
    const exp = {};
    for (const [table, cols] of Object.entries(data.schema)) {
      initial[table] = new Set(cols);
      exp[table] = true;
    }
    setAllowed(initial);
    setExpanded(exp);
    setIntrospecting(false);
  }

  function toggleTable(table) {
    setAllowed(prev => {
      const next = { ...prev };
      next[table] = next[table]?.size > 0 ? new Set() : new Set(schema[table]);
      return next;
    });
  }

  function toggleCol(table, col) {
    setAllowed(prev => {
      const cols = new Set(prev[table] || []);
      cols.has(col) ? cols.delete(col) : cols.add(col);
      return { ...prev, [table]: cols };
    });
  }

  function tableChecked(table) { return (allowed[table]?.size || 0) > 0; }
  function tableIndeterminate(table) {
    const s = allowed[table]?.size || 0;
    return s > 0 && s < (schema[table]?.length || 0);
  }

  // A "Publish to web" URL is /spreadsheets/d/e/2PACX-.../pubhtml — the old
  // regex matched /d/e and captured the literal "e" as the sheet id, which
  // then 404'd and created a permanently empty "connected" source. Published
  // URLs aren't readable via the CSV endpoint at all, so reject them with a
  // real explanation instead of silently accepting garbage.
  function parseSheetId(input) {
    const raw = input.trim();
    if (/\/spreadsheets\/d\/e\//.test(raw)) return null;
    const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/);
    if (match) return match[1];
    // Allow pasting a bare id, but only if it actually looks like one.
    return /^[a-zA-Z0-9-_]{20,}$/.test(raw) ? raw : null;
  }

  // ── Submit handlers ──────────────────────────────────
  function handleAddGsheet() {
    if (!gsheetUrl.trim()) return;
    const sheetId = parseSheetId(gsheetUrl);
    if (!sheetId) {
      alert(
        "That doesn't look like a Google Sheet link. Open your sheet and " +
        "copy the URL from your browser's address bar (it looks like " +
        "docs.google.com/spreadsheets/d/…)."
      );
      return;
    }
    // Committed as a real array — see sheetTabs' declaration for why this
    // is no longer a comma-joined string. A tab typed but not yet
    // committed (still sitting in the draft box) is included too, so
    // clicking Connect right after typing a name doesn't silently drop it.
    const pendingDraft = sheetTabDraft.trim();
    const tabs = pendingDraft && !sheetTabs.includes(pendingDraft) ? [...sheetTabs, pendingDraft] : sheetTabs;
    const range = readAll || tabs.length === 0 ? "all" : tabs;
    onAddSource({ type: "gsheets", label: sheetLabel || "Google Sheet", config: { sheet_id: sheetId, range } });
    setSheetLabel(""); setGsheetUrl(""); setSheetTabs([]); setSheetTabDraft(""); setReadAll(false);
  }

  async function handleAddExcel() {
    if (!excelFile) return;
    setUploadingExcel(true);
    try {
      onAddSource({ type: "excel_local", label: excelLabel || excelFile.name, _file: excelFile });
      setExcelLabel(""); setExcelFile(null);
    } finally {
      setUploadingExcel(false);
    }
  }

  function handleAddDatabase() {
    if (!schema) return;
    const allowedSchema = {};
    for (const [table, colSet] of Object.entries(allowed)) {
      if (colSet.size > 0) allowedSchema[table] = [...colSet];
    }
    onAddSource({ type: "postgres", label: dbLabel || "PostgreSQL", config: { url: dbUrl }, allowed_schema: allowedSchema });
    setDbLabel(""); setDbUrl(""); setSchema(null); setAllowed({});
  }

  function handleAddWebsite() {
    if (!websiteUrl.trim()) return;
    onAddSource({
      type: "website",
      label: websiteLabel || websiteUrl,
      config: { url: websiteUrl.trim(), full_site: fullSite, max_pages: maxPages },
    });
    setWebsiteLabel(""); setWebsiteUrl(""); setFullSite(true); setMaxPages(30);
  }

  function sourceTypeLabel(source) {
    if (source.type === "gsheets") {
      const range = source.config?.range;
      // Older sources still have the old comma-joined string; newer ones a
      // real array — this is a display join, not a parsing boundary, so
      // either shape is fine to show as-is.
      const tabsText = Array.isArray(range) ? range.join(", ") : range;
      return `Google Sheets${tabsText ? ` · ${tabsText === "all" ? "all tabs" : tabsText}` : ""}`;
    }
    if (source.type === "excel_local") return `Excel · ${source.config?.filename || "local file"}`;
    if (source.type === "postgres")   return "PostgreSQL";
    if (source.type === "website")    return `Website · ${source.config?.full_site ? `full site · max ${source.config?.max_pages} pages` : "single page"}`;
    return source.type;
  }

  function sourceIcon(source) {
    if (source.type === "gsheets")    return <Sheet size={14} className="text-green-600" />;
    if (source.type === "excel_local") return <Table size={14} className="text-emerald-600" />;
    if (source.type === "postgres")   return <Database size={14} className="text-blue-600" />;
    if (source.type === "website")    return <Globe size={14} className="text-purple-600" />;
    return <FileText size={14} className="text-gray-500" />;
  }

  const erroredFiles = files.filter(f => f.status === "error");

  return (
    <>
      <div className="space-y-5">

        {/* ── Page header ── */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Data Sources</h2>
          <p className="text-sm text-gray-500 mt-0.5">Connect documents, spreadsheets, websites, or databases to power your AI's answers.</p>
        </div>

        {/* ── Source type tab bar ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit border border-gray-200/60">
          {SOURCE_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setType(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  type === tab.id
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
          </div>

          <button
            onClick={() => setShowChat(true)}
            title="Test chat with your bot"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-indigo-200 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-50 transition-colors"
          >
            <MessageCircle size={14} />
            Test Chat
          </button>
        </div>

        {/* ── Documents tab ── */}
        {type === "documents" && (
          <div className="border rounded-xl p-6 space-y-4 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-50 border flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-gray-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Upload Documents</h3>
                  <p className="text-xs text-gray-500 mt-0.5">PDF, DOCX, PPTX, TXT supported</p>
                  <p className="text-xs text-gray-400 mt-0.5">{capHints.documents}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" disabled={uploading}>
                  <label className={`flex items-center gap-2 ${uploading ? "" : "cursor-pointer"}`}>
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading ? "Adding..." : "Select files"}
                    <input type="file" multiple accept=".pdf,.docx,.pptx,.txt" className="hidden" disabled={uploading} onChange={handleFileChange} />
                  </label>
                </Button>
                {erroredFiles.length > 0 && (
                  <Button size="sm" variant="outline" onClick={onRetryErrors} disabled={uploading}>
                    Retry {erroredFiles.length} failed
                  </Button>
                )}
              </div>
            </div>

            {files.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-10 text-center">
                <FileText size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No documents uploaded yet</p>
                <p className="text-xs text-gray-400 mt-1">Upload PDFs, Word docs, or text files to train your AI</p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between border rounded-lg px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-md bg-white border flex items-center justify-center shrink-0">
                        <FileText size={13} className="text-gray-400" />
                      </div>
                      {file.isNote && file.status !== "pending" ? (
                        <button
                          onClick={() => onEditFile(file)}
                          title="Click to edit this note"
                          className="truncate text-sm text-blue-600 hover:underline max-w-xs text-left"
                        >
                          {file.name}
                        </button>
                      ) : (
                        <span className="truncate text-sm text-gray-700 max-w-xs">{file.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        file.status === "indexed"  ? "bg-green-100 text-green-700" :
                        file.status === "pending"  ? "bg-yellow-100 text-yellow-700" :
                        file.status === "error"    ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {file.status === "indexed" ? "✓ Added to AI Knowledge" :
                         file.status === "pending" ? "Adding..." :
                         file.status === "error" ? "Failed" :
                         file.status.toUpperCase()}
                      </span>
                      {file.status !== "pending" && (
                        <button onClick={() => onDeleteFile(file)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Raw text tab ── */}
        {type === "text" && (
          <div className="border rounded-xl p-6 space-y-4 bg-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                <NotepadText size={16} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Add a Note</h3>
                <p className="text-xs text-gray-500 mt-0.5">Type anything you want your AI to know — a policy, an FAQ answer, a fact.</p>
              </div>
            </div>
            <Input
              placeholder="Label (e.g. Return Policy)"
              value={textLabel}
              onChange={e => setTextLabel(e.target.value)}
            />
            <div>
              <textarea
                placeholder="Type or paste your text here..."
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                maxLength={MAX_TEXT_CHARS}
                rows={8}
                className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{textContent.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()}</p>
            </div>
            <Button onClick={handleSaveText} disabled={savingText || !textContent.trim()}>
              {savingText ? <><Loader2 size={13} className="animate-spin mr-1" />Adding...</> : "Save & Index"}
            </Button>

            {files.length > 0 && (
              <div className="pt-2 border-t space-y-2">
                <p className="text-xs font-medium text-gray-500">Existing notes appear in the Documents tab, alongside uploaded files.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Google Sheets tab ── */}
        {type === "gsheet" && (
          <div className="border rounded-xl p-6 space-y-4 bg-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                <Sheet size={16} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Connect Google Sheets</h3>
                <p className="text-xs text-gray-500 mt-0.5">Make sure the sheet is set to "Anyone with the link can view"</p>
                <p className="text-xs text-gray-400 mt-0.5">{capHints.gsheet}</p>
              </div>
            </div>
            <Input placeholder="Label (e.g. Product Catalog)" value={sheetLabel} onChange={e => setSheetLabel(e.target.value)} />
            <Input placeholder="Paste Google Sheets link or Sheet ID" value={gsheetUrl} onChange={e => setGsheetUrl(e.target.value)} />
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <div className={`flex-1 flex flex-wrap items-center gap-1.5 border rounded-md px-2 py-1.5 min-h-9 ${readAll ? "bg-gray-50 opacity-60" : "bg-white"}`}>
                  {sheetTabs.map(tab => (
                    <span key={tab} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs rounded-full pl-2.5 pr-1 py-0.5">
                      {tab}
                      {!readAll && (
                        <button type="button" onClick={() => removeSheetTab(tab)} className="text-gray-400 hover:text-red-500 p-0.5">
                          <X size={11} />
                        </button>
                      )}
                    </span>
                  ))}
                  <input
                    value={sheetTabDraft}
                    onChange={e => setSheetTabDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); commitSheetTabDraft(); }
                      if (e.key === "Backspace" && !sheetTabDraft && sheetTabs.length > 0) {
                        removeSheetTab(sheetTabs[sheetTabs.length - 1]);
                      }
                    }}
                    onBlur={commitSheetTabDraft}
                    disabled={readAll}
                    placeholder={sheetTabs.length ? "" : readAll ? "All tabs will be read" : "Type a tab name, press Enter"}
                    className="flex-1 min-w-[100px] text-sm outline-none bg-transparent disabled:cursor-not-allowed"
                  />
                </div>
                <Button
                  type="button"
                  variant={readAll ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setReadAll(p => !p); if (!readAll) { setSheetTabs([]); setSheetTabDraft(""); } }}
                  className="whitespace-nowrap"
                >
                  {readAll ? "✓ Read All" : "Read All"}
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                {readAll
                  ? "All tabs will be indexed."
                  : "Leave empty to index every tab. Type a tab name and press Enter to add it — a tab name can safely contain a comma."}
              </p>
            </div>
            <Button onClick={handleAddGsheet} disabled={connecting || !gsheetUrl.trim()}>
              {connecting ? <><Loader2 size={13} className="animate-spin mr-1" />Connecting...</> : "Connect & Index"}
            </Button>
          </div>
        )}

        {/* ── Excel tab ── */}
        {type === "excel" && (
          <div className="border rounded-xl p-6 space-y-4 bg-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                <Table size={16} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Upload Excel File</h3>
                <p className="text-xs text-gray-500 mt-0.5">All sheets in the file will be indexed. Re-upload to update.</p>
                <p className="text-xs text-gray-400 mt-0.5">{capHints.excel}</p>
              </div>
            </div>
            <Input placeholder="Label (e.g. Sales Data)" value={excelLabel} onChange={e => setExcelLabel(e.target.value)} />
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm">
                <label className="cursor-pointer flex items-center gap-2">
                  <Upload size={14} />
                  {excelFile ? excelFile.name : "Choose .xlsx file"}
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => setExcelFile(e.target.files?.[0] || null)} />
                </label>
              </Button>
              {excelFile && (
                <button onClick={() => setExcelFile(null)} className="text-xs text-gray-400 hover:text-red-500">Remove</button>
              )}
            </div>
            <Button onClick={handleAddExcel} disabled={connecting || uploadingExcel || !excelFile}>
              {uploadingExcel || connecting ? <><Loader2 size={13} className="animate-spin mr-1" />Uploading...</> : "Upload & Index"}
            </Button>
          </div>
        )}

        {/* ── Website tab ── */}
        {type === "website" && (
          <div className="border rounded-xl p-6 space-y-4 bg-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                <Globe size={16} className="text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Crawl Website</h3>
                <p className="text-xs text-gray-500 mt-0.5">Website must be publicly accessible. Some sites with Cloudflare may not work.</p>
                <p className="text-xs text-gray-400 mt-0.5">{capHints.website}</p>
              </div>
            </div>
            <Input placeholder="Label (e.g. Company Website)" value={websiteLabel} onChange={e => setWebsiteLabel(e.target.value)} />
            <Input placeholder="https://yourwebsite.com" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" variant={fullSite ? "default" : "outline"} onClick={() => setFullSite(true)}>Full Site</Button>
              <Button size="sm" variant={!fullSite ? "default" : "outline"} onClick={() => setFullSite(false)}>Single Page</Button>
            </div>
            {fullSite && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-500 whitespace-nowrap">Max pages</label>
                <Input type="number" min={1} max={500} value={maxPages} onChange={e => setMaxPages(Number(e.target.value))} className="w-24" />
                <span className="text-xs text-gray-400">Recommended: 30</span>
              </div>
            )}
            <Button onClick={handleAddWebsite} disabled={connecting || !websiteUrl.trim()}>
              {connecting ? <><Loader2 size={13} className="animate-spin mr-1" />Crawling...</> : "Crawl & Index"}
            </Button>
          </div>
        )}

        {/* ── Database tab ── */}
        {type === "database" && (
          <div className="border rounded-xl p-6 space-y-4 bg-white shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <Database size={16} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Connect Database</h3>
                <p className="text-xs text-gray-500 mt-0.5">PostgreSQL and MySQL supported</p>
              </div>
            </div>
            <Input placeholder="Label (e.g. Production DB)" value={dbLabel} onChange={e => setDbLabel(e.target.value)} />
            <div className="flex gap-2">
              <Input
                placeholder="postgresql://user:pass@host:5432/dbname"
                value={dbUrl}
                onChange={e => { setDbUrl(e.target.value); setSchema(null); setAllowed({}); }}
                className="font-mono text-sm"
              />
              <Button variant="outline" onClick={handleIntrospect} disabled={!dbUrl.trim() || introspecting}>
                {introspecting ? <Loader2 size={14} className="animate-spin" /> : "Connect"}
              </Button>
            </div>
            {schema && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">Choose what the AI can access</p>
                  <span className="text-xs text-gray-400">
                    {Object.values(allowed).filter(s => s.size > 0).length} / {Object.keys(schema).length} tables selected
                  </span>
                </div>
                <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                  {Object.entries(schema).map(([table, cols]) => (
                    <div key={table}>
                      <div
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 cursor-pointer select-none"
                        onClick={() => setExpanded(prev => ({ ...prev, [table]: !prev[table] }))}
                      >
                        <input type="checkbox" checked={tableChecked(table)}
                          ref={el => { if (el) el.indeterminate = tableIndeterminate(table); }}
                          onChange={() => toggleTable(table)} onClick={e => e.stopPropagation()} />
                        {expanded[table] ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
                        <span className="text-sm font-mono font-medium">{table}</span>
                        <span className="text-xs text-gray-400 ml-auto">{allowed[table]?.size || 0}/{cols.length} cols</span>
                      </div>
                      {expanded[table] && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-8 py-2">
                          {cols.map(col => (
                            <label key={col} className="flex items-center gap-2 cursor-pointer py-0.5">
                              <input type="checkbox" checked={allowed[table]?.has(col) || false} onChange={() => toggleCol(table, col)} />
                              <span className="text-xs font-mono text-gray-600">{col}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Button onClick={handleAddDatabase} disabled={connecting || !Object.values(allowed).some(s => s.size > 0)}>
                  {connecting ? <><Loader2 size={13} className="animate-spin mr-1" />Connecting...</> : "Connect & Index"}
                </Button>
              </div>
            )}
            {!schema && !introspecting && dbUrl.trim() && (
              <p className="text-xs text-gray-400">Click Connect to load your database schema.</p>
            )}
          </div>
        )}

        {/* ── Connected Sources ── */}
        {sources.length > 0 && (
          <div className="border rounded-xl p-6 space-y-3 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Connected Sources</h3>
              <span className="text-xs text-gray-400">{sources.length} connected</span>
            </div>
            <div className="space-y-2">
              {sources.map((source) => (
                <div key={source.id} className="flex items-center justify-between border rounded-lg px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-white border flex items-center justify-center shrink-0">
                      {sourceIcon(source)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{source.label}</p>
                      <p className="text-xs text-gray-400">{sourceTypeLabel(source)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {(source.type === "gsheets" || source.type === "website") && (
                      <Button variant="outline" size="sm" onClick={() => onReload(source.id, source.label)} className="flex items-center gap-1">
                        <RefreshCw size={12} /> Reload
                      </Button>
                    )}
                    {source.type === "excel_local" && (
                      <Button asChild={reuploadingId !== source.id} variant="outline" size="sm" disabled={reuploadingId === source.id}>
                        {reuploadingId === source.id ? (
                          <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" />Indexing...</span>
                        ) : (
                          <label className="cursor-pointer flex items-center gap-1">
                            <RefreshCw size={12} /> Re-upload
                            <input type="file" accept=".xlsx,.xls" className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setReuploadingId(source.id);
                                await onReuploadExcel(source.id, source.label, file);
                                setReuploadingId(null);
                                e.target.value = "";
                              }} />
                          </label>
                        )}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { setSourceToDelete(source); setDeleteDialogOpen(true); }}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AppAlertDialog
        open={deleteDialogOpen}
        title="Delete data source?"
        description={<><strong>{sourceToDelete?.label}</strong> will be permanently deleted, including all indexed data.</>}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => { if (sourceToDelete) onDeleteSource(sourceToDelete.id); setDeleteDialogOpen(false); setSourceToDelete(null); }}
        onCancel={() => { setDeleteDialogOpen(false); setSourceToDelete(null); }}
      />

      {showChat && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowChat(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-3xl space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pt-2">
              <p className="text-sm font-semibold text-gray-800 px-2">Test chat — uses all your connected sources</p>
              <button onClick={() => setShowChat(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <ChatTab projectId={projectId} />
          </div>
        </div>
      )}
    </>
  );
}