// src/app/dashboard/[projectId]/DocumentsTab.js

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Trash2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import AppAlertDialog from "@/components/alertdialog";

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
  const handleChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length) onSelectFiles(selected);
  };

  const [type, setType] = useState("gsheet");

  // ── Google Sheets state ──────────────────────────────
  const [sheetLabel, setSheetLabel] = useState("");
  const [gsheetUrl, setGsheetUrl] = useState("");
  const [sheetRange, setSheetRange] = useState("");
  const [readAll, setReadAll] = useState(false);

  // ── Database state ───────────────────────────────────
  const [dbLabel, setDbLabel] = useState("");
  const [dbUrl, setDbUrl] = useState("");
  const [introspecting, setIntrospecting] = useState(false);
  const [schema, setSchema] = useState(null);
  const [allowed, setAllowed] = useState({});
  const [expanded, setExpanded] = useState({});

  // ── Excel state ──────────────────────────────────────
  const [excelLabel, setExcelLabel] = useState("");
  const [excelFile, setExcelFile] = useState(null);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [reuploadingId, setReuploadingId] = useState(null);

  // ── Website state ─────────────────────────────
  const [websiteLabel, setWebsiteLabel] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [fullSite, setFullSite] = useState(true);
  const [maxPages, setMaxPages] = useState(30);

  // ── Delete source dialog ─────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sourceToDelete, setSourceToDelete] = useState(null);

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

  // ── Checkbox helpers ─────────────────────────────────
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

  function tableChecked(table) {
    return (allowed[table]?.size || 0) > 0;
  }

  function tableIndeterminate(table) {
    const s = allowed[table]?.size || 0;
    return s > 0 && s < (schema[table]?.length || 0);
  }

  // ── Submit Google Sheets / Database ──────────────────
  function handleAddSource() {
    if (type === "gsheet") {
      if (!gsheetUrl.trim()) return;
      const match = gsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      const sheetId = match ? match[1] : gsheetUrl.trim();
      const range = readAll || !sheetRange.trim() ? "all" : sheetRange.trim();
      onAddSource({ type: "gsheets", label: sheetLabel || "Google Sheet", config: { sheet_id: sheetId, range } });
      setSheetLabel(""); setGsheetUrl(""); setSheetRange(""); setReadAll(false);
    }

    if (type === "database") {
      if (!schema) return;
      const allowedSchema = {};
      for (const [table, colSet] of Object.entries(allowed)) {
        if (colSet.size > 0) allowedSchema[table] = [...colSet];
      }
      onAddSource({ type: "postgres", label: dbLabel || "PostgreSQL", config: { url: dbUrl }, allowed_schema: allowedSchema });
      setDbLabel(""); setDbUrl(""); setSchema(null); setAllowed({});
    }
  }

  // ── Submit Excel ──────────────────────────────────────
  async function handleAddExcel() {
    // Keep only this:
    if (!excelFile) return;
    setUploadingExcel(true);
    try {
      onAddSource({
        type: "excel_local",
        label: excelLabel || excelFile.name,
        _file: excelFile,
      });
      setExcelLabel(""); setExcelFile(null);
    } finally {
      setUploadingExcel(false);
    }
  }

  // ── Delete source with confirmation ──────────────────
  function requestDeleteSource(source) {
    setSourceToDelete(source);
    setDeleteDialogOpen(true);
  }

  function confirmDeleteSource() {
    if (sourceToDelete) onDeleteSource(sourceToDelete.id);
    setDeleteDialogOpen(false);
    setSourceToDelete(null);
  }

  const canSubmitSheet = type === "gsheet" ? gsheetUrl.trim().length > 0 : schema && Object.values(allowed).some(s => s.size > 0);
  const canSubmitExcel = !!excelFile;

  // Source type label helper
  function sourceTypeLabel(source) {
    if (source.type === "gsheets") return `Google Sheets${source.config?.range ? ` · ${source.config.range === "all" ? "all tabs" : source.config.range}` : ""}`;
    if (source.type === "excel_local") return `Excel · ${source.config?.filename || "local file"}`;
    if (source.type === "postgres") return "PostgreSQL";
    if (source.type === "website") return `Website · ${source.config?.full_site ? `full site · max ${source.config?.max_pages} pages` : "single page"}`;
    return source.type;
  }

  return (
    <>
      <div className="space-y-6">

        {/* ══════════════════════════════════════════════════
            DOCUMENTS
        ══════════════════════════════════════════════════ */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Documents</h2>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <label className="cursor-pointer flex items-center gap-2">
                    <Upload size={16} />
                    Select files
                    <Input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.pptx,.txt"
                      className="hidden"
                      onChange={handleChange}
                    />
                  </label>
                </Button>
                <Button onClick={onUpload} disabled={uploading || files.every(f => f.status !== "pending")}>
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </div>

            {files.length === 0 && (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            )}

            <div className="space-y-2">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between border rounded px-3 py-2">
                  <span className="truncate text-sm">{file.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs border rounded px-2 py-0.5">{file.status.toUpperCase()}</span>
                    <button onClick={() => onDeleteFile(file)} className="text-muted-foreground hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════
            DATA SOURCES
        ══════════════════════════════════════════════════ */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Data Sources</h2>

            {/* Source type tabs */}
            <div className="flex gap-2 flex-wrap">
            {["gsheet", "excel", "website", "database"].map(t => (
              <Button
                key={t}
                variant={type === t ? "default" : "outline"}
                onClick={() => { setType(t); setSchema(null); }}
                size="sm"
              >
                {t === "gsheet" ? "Google Sheets"
                  : t === "excel" ? "Excel"
                  : t === "website" ? "Website"
                  : "Database"}
              </Button>
            ))}
            </div>

            {/* ── Google Sheets ── */}
            {type === "gsheet" && (
              <div className="space-y-2">
                <Input placeholder="Label (e.g. Inventory Sheet)" value={sheetLabel} onChange={e => setSheetLabel(e.target.value)} />
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
                <p className="text-xs text-muted-foreground">
                  {readAll ? "All tabs will be indexed." : "Leave empty or click Read All to index every tab. Separate multiple tab names with commas."}
                </p>
              </div>
            )}

            {/* ── Excel ── */}
            {type === "excel" && (
              <div className="space-y-3">

                <Input
                  placeholder="Label (e.g. Sales Data)"
                  value={excelLabel}
                  onChange={e => setExcelLabel(e.target.value)}
                />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <label className="cursor-pointer flex items-center gap-2">
                        <Upload size={14} />
                        {excelFile ? excelFile.name : "Choose .xlsx file"}
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={e => setExcelFile(e.target.files?.[0] || null)}
                        />
                      </label>
                    </Button>
                    {excelFile && (
                      <button onClick={() => setExcelFile(null)} className="text-xs text-muted-foreground hover:text-red-500">
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All sheets in the file will be indexed. Re-upload to update.
                  </p>
                </div>

                <Button onClick={handleAddExcel} disabled={connecting || uploadingExcel || !canSubmitExcel}>
                  {uploadingExcel || connecting ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
                  "Upload & Index"
                </Button>
              </div>
            )}
  
            {type === "website" && (
              <div className="space-y-3">
                <Input
                  placeholder="Label (e.g. Company Website)"
                  value={websiteLabel}
                  onChange={e => setWebsiteLabel(e.target.value)}
                />
                <Input
                  placeholder="https://yourwebsite.com"
                  value={websiteUrl}
                  onChange={e => setWebsiteUrl(e.target.value)}
                />
            
                {/* Single page vs full site toggle */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={fullSite ? "default" : "outline"}
                    onClick={() => setFullSite(true)}
                  >
                    Full Site
                  </Button>
                  <Button
                    size="sm"
                    variant={!fullSite ? "default" : "outline"}
                    onClick={() => setFullSite(false)}
                  >
                    Single Page
                  </Button>
                </div>
            
                {/* Max pages input — only show for full site */}
                {fullSite && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-muted-foreground whitespace-nowrap">
                      Max pages
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={maxPages}
                      onChange={e => setMaxPages(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-xs text-muted-foreground">
                      Recommended: 30. Higher values increase indexing time and cost.
                    </span>
                  </div>
                )}
            
                <p className="text-xs text-muted-foreground">
                  {fullSite
                    ? `All pages under the same domain will be crawled (up to ${maxPages} pages).`
                    : "Only the exact URL you entered will be scraped."}
                </p>
                <p className="text-xs text-muted-foreground">
                  *The website must be publicly accessible. Some websites with anti-bot
                  protection (e.g. Cloudflare) may not be crawlable.
                </p>
            
                <Button
                  onClick={() => {
                    if (!websiteUrl.trim()) return;
                    onAddSource({
                      type: "website",
                      label: websiteLabel || websiteUrl,
                      config: {
                        url: websiteUrl.trim(),
                        full_site: fullSite,
                        max_pages: maxPages,
                      },
                    });
                    setWebsiteLabel("");
                    setWebsiteUrl("");
                    setFullSite(true);
                    setMaxPages(50);
                  }}
                  disabled={connecting || !websiteUrl.trim()}
                >
                  {connecting ? <><Loader2 size={14} className="animate-spin mr-2" />Crawling...</> : "Crawl & Index"}
                </Button>
              </div>
            )}


            {/* ── Database ── */}
            {type === "database" && (
              <div className="space-y-3">
                <Input placeholder="Label (e.g. Production DB)" value={dbLabel} onChange={e => setDbLabel(e.target.value)} />
                <div className="flex gap-2">
                  <Input
                    placeholder="postgresql://user:pass@host:5432/dbname  or  mysql://user:pass@host:3306/dbname"
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
                      <p className="text-sm font-medium">Choose what the AI can access</p>
                      <span className="text-xs text-muted-foreground">
                        {Object.values(allowed).filter(s => s.size > 0).length} / {Object.keys(schema).length} tables
                      </span>
                    </div>
                    <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                      {Object.entries(schema).map(([table, cols]) => (
                        <div key={table}>
                          <div
                            className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 cursor-pointer select-none"
                            onClick={() => setExpanded(prev => ({ ...prev, [table]: !prev[table] }))}
                          >
                            <input
                              type="checkbox"
                              checked={tableChecked(table)}
                              ref={el => { if (el) el.indeterminate = tableIndeterminate(table); }}
                              onChange={() => toggleTable(table)}
                              onClick={e => e.stopPropagation()}
                            />
                            {expanded[table] ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronRight size={13} className="text-muted-foreground" />}
                            <span className="text-sm font-mono font-medium">{table}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{allowed[table]?.size || 0} / {cols.length} cols</span>
                          </div>
                          {expanded[table] && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-8 py-2">
                              {cols.map(col => (
                                <label key={col} className="flex items-center gap-2 cursor-pointer py-0.5">
                                  <input type="checkbox" checked={allowed[table]?.has(col) || false} onChange={() => toggleCol(table, col)} />
                                  <span className="text-xs font-mono text-slate-700">{col}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!schema && !introspecting && dbUrl.trim() && (
                  <p className="text-xs text-muted-foreground">Click Connect to load your database schema.</p>
                )}
              </div>
            )}

            {/* Submit for gsheet and database */}
            {(type === "gsheet" || type === "database") && (
              <Button onClick={handleAddSource} disabled={connecting || !canSubmitSheet}>
                {connecting ? "Connecting..." : "Connect & Index"}
              </Button>
            )}
          </CardContent>
        

        {/* ══════════════════════════════════════════════════
            CONNECTED SOURCES
        ══════════════════════════════════════════════════ */}
        
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Connected Sources</h2>

            {sources.length === 0 && (
              <p className="text-sm text-muted-foreground">No sources added yet.</p>
            )}

            <div className="space-y-2">
            {sources.map((source) => (
              <div key={source.id} className="flex items-center justify-between border rounded px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{source.label}</p>
                  <p className="text-xs text-muted-foreground">{sourceTypeLabel(source)}</p>
                </div>
                <div className="flex gap-2">
                  {/* Google Sheets / Excel Online — re-fetch from URL */}
                  {(source.type === "gsheets" || source.type === "website") && (
                    <Button variant="outline" size="sm" onClick={() => onReload(source.id)}>
                      Reload
                    </Button>
                  )}

                  {/* Local Excel — re-upload file */}
                  {source.type === "excel_local" && (
                    <Button
                      asChild={reuploadingId !== source.id}
                      variant="outline"
                      size="sm"
                      disabled={reuploadingId === source.id}
                    >
                      {reuploadingId === source.id ? (
                        <span className="flex items-center gap-1">
                          <Loader2 size={13} className="animate-spin" />
                          Indexing...
                        </span>
                      ) : (
                        <label className="cursor-pointer">
                          Re-upload
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setReuploadingId(source.id);
                              await onReuploadExcel(source.id, source.label, file);
                              setReuploadingId(null);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </Button>
                  )}

                  <Button variant="destructive" size="sm" onClick={() => requestDeleteSource(source)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirmation dialog */}
      <AppAlertDialog
        open={deleteDialogOpen}
        title="Delete data source?"
        description={
          <>
            <strong>{sourceToDelete?.label}</strong> will be permanently deleted,
            including all indexed data from this source.
          </>
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteSource}
        onCancel={() => { setDeleteDialogOpen(false); setSourceToDelete(null); }}
      />
    </>
  );
}