"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Trash2, ChevronDown, ChevronRight, Loader2, FileText, Globe, Database, Table, Sheet, RefreshCw } from "lucide-react";
import AppAlertDialog from "@/components/alertdialog";

const SOURCE_TABS = [
  { id: "documents", label: "Documents", icon: FileText },
  { id: "gsheet",   label: "Google Sheets", icon: Sheet },
  { id: "excel",    label: "Excel", icon: Table },
  { id: "website",  label: "Website", icon: Globe },
  { id: "database", label: "Database", icon: Database },
];

export default function DocumentsTab({
  files,
  onSelectFiles,
  onUpload,
  uploading,
  onDeleteFile,
  onAddSource,
  connecting,
  sources,
  onReload,
  onDeleteSource,
  onReuploadExcel,
}) {
  const [type, setType] = useState("documents");

  // ── Documents state ──────────────────────────────────
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length) onSelectFiles(selected);
  };

  // ── Google Sheets state ──────────────────────────────
  const [sheetLabel, setSheetLabel]   = useState("");
  const [gsheetUrl, setGsheetUrl]     = useState("");
  const [sheetRange, setSheetRange]   = useState("");
  const [readAll, setReadAll]         = useState(false);

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
      body: JSON.stringify({ db_url: dbUrl }),
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

  // ── Submit handlers ──────────────────────────────────
  function handleAddGsheet() {
    if (!gsheetUrl.trim()) return;
    const match = gsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const sheetId = match ? match[1] : gsheetUrl.trim();
    const range = readAll || !sheetRange.trim() ? "all" : sheetRange.trim();
    onAddSource({ type: "gsheets", label: sheetLabel || "Google Sheet", config: { sheet_id: sheetId, range } });
    setSheetLabel(""); setGsheetUrl(""); setSheetRange(""); setReadAll(false);
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
    if (source.type === "gsheets")    return `Google Sheets${source.config?.range ? ` · ${source.config.range === "all" ? "all tabs" : source.config.range}` : ""}`;
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

  const pendingFiles = files.filter(f => f.status === "pending");
  const indexedFiles = files.filter(f => f.status !== "pending");

  return (
    <>
      <div className="space-y-4">

        {/* ── Source type tab bar ── */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
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

        {/* ── Documents tab ── */}
        {type === "documents" && (
          <div className="border rounded-xl p-6 space-y-4 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Upload Documents</h3>
                <p className="text-xs text-gray-500 mt-0.5">PDF, DOCX, PPTX, TXT supported</p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <label className="cursor-pointer flex items-center gap-2">
                    <Upload size={14} />
                    Select files
                    <input type="file" multiple accept=".pdf,.docx,.pptx,.txt" className="hidden" onChange={handleFileChange} />
                  </label>
                </Button>
                <Button
                  size="sm"
                  onClick={onUpload}
                  disabled={uploading || pendingFiles.length === 0}
                >
                  {uploading ? <><Loader2 size={13} className="animate-spin mr-1" />Uploading...</> : "Upload"}
                </Button>
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
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} className="text-gray-400 shrink-0" />
                      <span className="truncate text-sm text-gray-700 max-w-xs">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        file.status === "indexed"  ? "bg-green-100 text-green-700" :
                        file.status === "pending"  ? "bg-yellow-100 text-yellow-700" :
                        file.status === "error"    ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {file.status === "indexed" ? "✓ Indexed" : file.status.toUpperCase()}
                      </span>
                      <button onClick={() => onDeleteFile(file)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Google Sheets tab ── */}
        {type === "gsheet" && (
          <div className="border rounded-xl p-6 space-y-4 bg-white">
            <div>
              <h3 className="font-semibold text-gray-900">Connect Google Sheets</h3>
              <p className="text-xs text-gray-500 mt-0.5">Make sure the sheet is set to "Anyone with the link can view"</p>
            </div>
            <Input placeholder="Label (e.g. Product Catalog)" value={sheetLabel} onChange={e => setSheetLabel(e.target.value)} />
            <Input placeholder="Paste Google Sheets link or Sheet ID" value={gsheetUrl} onChange={e => setGsheetUrl(e.target.value)} />
            <div className="flex gap-2 items-center">
              <Input
                placeholder={readAll ? "All tabs will be read" : "Tab names e.g. Sheet1, Sales (leave empty to read all)"}
                value={sheetRange}
                onChange={e => { setSheetRange(e.target.value); setReadAll(false); }}
                disabled={readAll}
                className="flex-1"
              />
              <Button
                type="button"
                variant={readAll ? "default" : "outline"}
                size="sm"
                onClick={() => { setReadAll(p => !p); if (!readAll) setSheetRange(""); }}
                className="whitespace-nowrap"
              >
                {readAll ? "✓ Read All" : "Read All"}
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              {readAll ? "All tabs will be indexed." : "Leave empty to index every tab. Separate multiple tab names with commas."}
            </p>
            <Button onClick={handleAddGsheet} disabled={connecting || !gsheetUrl.trim()}>
              {connecting ? <><Loader2 size={13} className="animate-spin mr-1" />Connecting...</> : "Connect & Index"}
            </Button>
          </div>
        )}

        {/* ── Excel tab ── */}
        {type === "excel" && (
          <div className="border rounded-xl p-6 space-y-4 bg-white">
            <div>
              <h3 className="font-semibold text-gray-900">Upload Excel File</h3>
              <p className="text-xs text-gray-500 mt-0.5">All sheets in the file will be indexed. Re-upload to update.</p>
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
          <div className="border rounded-xl p-6 space-y-4 bg-white">
            <div>
              <h3 className="font-semibold text-gray-900">Crawl Website</h3>
              <p className="text-xs text-gray-500 mt-0.5">Website must be publicly accessible. Some sites with Cloudflare may not work.</p>
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
          <div className="border rounded-xl p-6 space-y-4 bg-white">
            <div>
              <h3 className="font-semibold text-gray-900">Connect Database</h3>
              <p className="text-xs text-gray-500 mt-0.5">PostgreSQL and MySQL supported</p>
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
          <div className="border rounded-xl p-6 space-y-3 bg-white">
            <h3 className="font-semibold text-gray-900">Connected Sources</h3>
            <div className="space-y-2">
              {sources.map((source) => (
                <div key={source.id} className="flex items-center justify-between border rounded-lg px-3 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    {sourceIcon(source)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{source.label}</p>
                      <p className="text-xs text-gray-400">{sourceTypeLabel(source)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {(source.type === "gsheets" || source.type === "website") && (
                      <Button variant="outline" size="sm" onClick={() => onReload(source.id)} className="flex items-center gap-1">
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
    </>
  );
}