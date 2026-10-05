"use client";

// NodeConfigDialog.js
//
// Full node settings, in a modal — replaces the old accordion that
// expanded inline inside each ~240-300px node box on the canvas. The
// per-type field logic itself is unchanged from the previous inline
// version; only where it renders moved.
import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, Plus, Info, TriangleAlert } from "lucide-react";
import { nodeInfo, newOptionId } from "./nodeRegistry";
import { uploadMedia } from "@/lib/uploadMedia";
import WebNodeFields, { VariableChips } from "./WebNodeFields";

// Website flows show media in the browser, not through WhatsApp, so they
// take the formats browsers play (WEBP/GIF images, WEBM video, WAV audio).
// Uploaded into separate folders with their own size/type rules.
const WEB_MEDIA_CONFIG = {
  message_media:    { kind: "image",    folder: "web-image",    accept: "image/jpeg,image/png,image/webp,image/gif", label: "Image",    maxMB: 5,  exts: "JPG, PNG, WEBP, GIF" },
  message_video:    { kind: "video",    folder: "web-video",    accept: "video/mp4,video/webm",                      label: "Video",    maxMB: 16, exts: "MP4, WEBM" },
  message_document: { kind: "document", folder: "web-document", accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt", label: "Document", maxMB: 16, exts: "PDF, Word, Excel, PPT, CSV" },
  message_audio:    { kind: "audio",    folder: "web-audio",    accept: "audio/mpeg,audio/ogg,audio/wav,audio/mp4,.m4a", label: "Audio", maxMB: 16, exts: "MP3, OGG, WAV, M4A" },
};
const WEB_ONLY_TYPES = new Set(["quick_replies", "carousel", "ask_input", "form", "rating", "open_url"]);

const MEDIA_CONFIG = {
  // Only formats WhatsApp itself accepts — anything else uploads fine and
  // then silently never reaches the customer.
  message_media:    { kind: "image",    accept: "image/jpeg,image/png",                          label: "Image",    maxMB: 5,   exts: "JPG, PNG" },
  message_video:    { kind: "video",    accept: "video/mp4,video/3gpp",                          label: "Video",    maxMB: 16,  exts: "MP4, 3GP" },
  message_document: { kind: "document", accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt", label: "Document", maxMB: 16,  exts: "PDF, Word, Excel, PPT, CSV" },
  message_audio:    { kind: "audio",    accept: "audio/mpeg,audio/ogg,audio/aac,audio/mp4,.m4a",  label: "Audio",    maxMB: 16,  exts: "MP3, OGG, AAC, M4A" },
};

// Our own uploads live in Supabase Storage; anything else was pasted.
const isStoredFile = (v) => !!v && v.includes("/storage/v1/object/public/");


function MediaUpload({ nodeType, urlKey, value, onChange, channel = "whatsapp" }) {
  const [mode, setMode] = useState(value && !isStoredFile(value) ? "url" : "upload");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const web = channel === "web";
  const cfg = (web ? WEB_MEDIA_CONFIG[nodeType] : MEDIA_CONFIG[nodeType]) || MEDIA_CONFIG.message_media;

  // A pasted link is opened by the backend to confirm it's really a file
  // WhatsApp can send — a web page or WEBP is accepted by Meta and then
  // never delivered.
  const [linkCheck, setLinkCheck] = useState(null); // null | {state, reason}
  useEffect(() => {
    const url = (value || "").trim();
    if (mode !== "url" || !/^https?:\/\/\S+\.\S+/.test(url)) { setLinkCheck(null); return; }
    // Website media is shown by the visitor's browser; only https matters.
    if (web) {
      setLinkCheck(url.toLowerCase().startsWith("https://") ? null
        : { state: "bad", reason: "Use an https:// link - browsers block insecure media on most sites." });
      return;
    }
    let cancelled = false;
    setLinkCheck({ state: "checking" });
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/flows/check-media-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, kind: cfg.kind }),
        });
        const d = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setLinkCheck(null);
        else setLinkCheck(d.ok ? { state: "ok" } : { state: "bad", reason: d.reason });
      } catch {
        if (!cancelled) setLinkCheck(null);
      }
    }, 700);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value, mode, cfg.kind, web]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > cfg.maxMB * 1024 * 1024) { setError(`Max ${cfg.maxMB}MB allowed.`); return; }
    setUploading(true);
    const { url, error: uploadError } = await uploadMedia(file, cfg.folder || nodeType);
    setUploading(false);
    if (uploadError) { setError(uploadError); return; }
    onChange(urlKey, url);
    setMode("upload");
  };

  const handleClear = () => { onChange(urlKey, ""); setMode("url"); setError(""); if (fileRef.current) fileRef.current.value = ""; };
  const isUploaded = isStoredFile(value) && mode === "upload";

  return (
    <div className="space-y-1.5">
      <div className="flex rounded-md overflow-hidden border">
        {["url", "upload"].map(m => (
          <button key={m} type="button"
            onClick={() => { if (m === "url" && isUploaded) handleClear(); else setMode(m); }}
            className={`flex-1 py-1 text-xs ${mode === m ? "bg-gray-900 text-white font-medium" : "bg-white text-muted-foreground"}`}>
            {m === "url" ? "Link" : "Upload"}
          </button>
        ))}
      </div>
      {mode === "url" && (
        <Input className="font-mono text-xs" placeholder="https://example.com/file"
          value={value || ""} onChange={e => onChange(urlKey, e.target.value)} />
      )}
      {mode === "url" && linkCheck?.state === "checking" && (
        <p className="text-xs text-muted-foreground">Checking link…</p>
      )}
      {mode === "url" && linkCheck?.state === "ok" && (
        <p className="text-xs text-green-700">✓ WhatsApp can send this {cfg.label.toLowerCase()}.</p>
      )}
      {mode === "url" && linkCheck?.state === "bad" && (
        <p className="text-xs text-red-600 flex items-start gap-1">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" />
          <span>{web ? linkCheck.reason
            : `${linkCheck.reason} Use a link that opens the file itself (${cfg.exts}), or upload it instead. Customers will get the link as text.`}</span>
        </p>
      )}
      {mode === "upload" && (
        <>
          {isUploaded ? (
            <div className="space-y-1.5">
              {nodeType === "message_media" || urlKey === "image" ? (
                <div className="relative rounded-md overflow-hidden border">
                  <img src={value} alt="preview" className="w-full max-h-72 object-contain bg-gray-50 block" />
                  <button type="button" onClick={handleClear}
                    className="absolute top-1.5 right-1.5 bg-black/50 rounded-full w-5 h-5 flex items-center justify-center text-white">
                    <X size={11} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-md px-2 py-1.5">
                  <span className="text-xs text-green-800 flex-1 truncate">{value.split("/").pop()}</span>
                  <button type="button" onClick={handleClear} className="text-red-500"><X size={13} /></button>
                </div>
              )}
            </div>
          ) : (
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed rounded-md py-3 px-2 text-center cursor-pointer bg-gray-50">
              {uploading
                ? <p className="text-xs text-muted-foreground m-0">Uploading...</p>
                : <>
                    <p className="text-xs font-medium m-0">Click to upload {cfg.label}</p>
                    <p className="text-[10px] text-muted-foreground m-0 mt-0.5">{cfg.exts} · Max {cfg.maxMB}MB</p>
                  </>}
            </div>
          )}
          <input ref={fileRef} type="file" accept={cfg.accept} className="hidden" onChange={handleFile} />
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

const toIdFn = (label) =>
  (label || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "next";

export default function NodeConfigDialog({ node, onOpenChange, onChange, onSetStart, catalogs, events,
  channel = "whatsapp", variables = [], flowId }) {
  if (!node) return null;
  const { id, data } = node;
  const type = data.type || "message";
  const content = data.content || {};
  const isStart = data.isStart || false;
  const info = nodeInfo(type);
  const Icon = info.icon;
  const web = channel === "web";

  const update = (patch) => onChange(id, patch);
  const updateContent = (key, val) => update({ content: { ...content, [key]: val } });

  // WhatsApp allows 3 buttons / 10 list rows; the website just renders them.
  const maxButtons = web ? 50 : 3;
  const maxRows = web ? 50 : 10;
  const labelMax = web ? 40 : 20;

  const updateButtonLabel = (idx, val) => {
    const btns = [...(content.buttons || [])];
    btns[idx] = { ...btns[idx], label: val };
    updateContent("buttons", btns);
  };
  const addButton = () => {
    if ((content.buttons || []).length >= maxButtons) return;
    const btn = { label: `Option ${(content.buttons || []).length + 1}` };
    if (web) btn.id = newOptionId("o");
    updateContent("buttons", [...(content.buttons || []), btn]);
  };
  const removeButton = (idx) => { const b = [...(content.buttons || [])]; b.splice(idx, 1); updateContent("buttons", b); };
  const updateRowLabel = (sIdx, rIdx, val) => {
    const s = JSON.parse(JSON.stringify(content.sections || []));
    s[sIdx].rows[rIdx].label = val; updateContent("sections", s);
  };
  // WhatsApp rejects the whole list message (customer gets nothing) past
  // 10 rows in total across all sections.
  const totalRows = (content.sections || []).reduce((n, sec) => n + (sec.rows || []).length, 0);
  const addRow = (sIdx) => {
    if (totalRows >= maxRows) return;
    const s = JSON.parse(JSON.stringify(content.sections || []));
    const row = { label: `Option ${s[sIdx].rows.length + 1}` };
    if (web) row.id = newOptionId("o");
    s[sIdx].rows.push(row); updateContent("sections", s);
  };
  const removeRow = (sIdx, rIdx) => {
    const s = JSON.parse(JSON.stringify(content.sections || []));
    s[sIdx].rows.splice(rIdx, 1); updateContent("sections", s);
  };

  const needsBody = !["back_to_menu", "time_delay", "message_shop", "message_booking", "message_event"].includes(type);
  const insertVar = (token) => updateContent("body", `${content.body || ""}${token}`);
  const ImageField = ({ value, onChange: set }) => (
    <MediaUpload nodeType="message_media" channel="web" urlKey="image" value={value} onChange={(_, v) => set(v)} />
  );

  return (
    <Dialog open={!!node} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              style={{ background: info.badge, color: info.text }}>
              <Icon size={15} />
            </span>
            {info.label}
          </DialogTitle>
          <DialogDescription>{(web && info.webDescription) || info.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={isStart} onCheckedChange={(v) => onSetStart(id, !!v)} />
            Set as start node
          </label>

          {needsBody && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {type === "ask_input" || type === "rating" ? "Question" : type === "end" ? "Closing message (optional)" : "Message"}
              </Label>
              <Textarea rows={3} value={content.body || ""}
                onChange={e => updateContent("body", e.target.value)}
                placeholder="Type your message..." />
              {web && <VariableChips variables={variables} onInsert={insertVar} />}
              {!web && (type === "message_buttons" || type === "message_list") && !(content.body || "").trim() && (
                <p className="text-xs text-amber-700">WhatsApp needs a message above the options — until you add one, customers see &quot;Please choose an option:&quot;.</p>
              )}
            </div>
          )}

          {web && WEB_ONLY_TYPES.has(type) && (
            <WebNodeFields type={type} content={content} updateContent={updateContent}
              variables={variables} flowId={flowId} ImageField={ImageField} />
          )}

          {type === "message_buttons" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Buttons{web ? "" : " (max 3)"}</Label>
              {(content.buttons || []).map((btn, idx) => (
                <div key={btn.id || idx} className="flex gap-1.5 items-center">
                  <Input placeholder={`Button ${idx + 1}`} value={btn.label || ""} maxLength={labelMax}
                    onChange={e => updateButtonLabel(idx, e.target.value)} />
                  <button onClick={() => removeButton(idx)} className="text-red-400 shrink-0"><X size={15} /></button>
                </div>
              ))}
              {(content.buttons || []).length < maxButtons && (
                <Button variant="outline" size="sm" className="w-full" onClick={addButton}>
                  <Plus size={13} className="mr-1" /> Add button
                </Button>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1 pt-0.5">
                <Info size={11} /> Drag from each button's own handle on the canvas to connect it.
              </p>
            </div>
          )}

          {type === "message_list" && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Button text</Label>
                <Input placeholder="View Options" value={content.button_text || ""} maxLength={labelMax}
                  onChange={e => updateContent("button_text", e.target.value)} />
              </div>
              {(content.sections || []).map((section, sIdx) => (
                <div key={sIdx} className="space-y-1.5">
                  <Input placeholder="Section title (optional)" value={section.title || ""} maxLength={24}
                    onChange={e => { const s = JSON.parse(JSON.stringify(content.sections)); s[sIdx].title = e.target.value; updateContent("sections", s); }} />
                  {(section.rows || []).map((row, rIdx) => (
                    <div key={row.id || rIdx} className="flex gap-1.5 items-center">
                      <Input placeholder={`Row ${rIdx + 1}`} value={row.label || ""} maxLength={web ? 40 : 24}
                        onChange={e => updateRowLabel(sIdx, rIdx, e.target.value)} />
                      <button onClick={() => removeRow(sIdx, rIdx)} className="text-red-400 shrink-0"><X size={15} /></button>
                    </div>
                  ))}
                  {totalRows < maxRows && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => addRow(sIdx)}>
                      <Plus size={13} className="mr-1" /> Add row
                    </Button>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info size={11} /> {web ? "Long lists get a search box on the website." : "Max 10 rows in total (WhatsApp limit)."} Drag from each row&apos;s own handle on the canvas to connect it.
              </p>
            </div>
          )}

          {type === "message_media" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Image</Label>
              <MediaUpload channel={channel} nodeType="message_media" urlKey="media_url" value={content.media_url || ""} onChange={updateContent} />
            </div>
          )}

          {type === "message_video" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Video</Label>
              <MediaUpload channel={channel} nodeType="message_video" urlKey="video_url" value={content.video_url || ""} onChange={updateContent} />
            </div>
          )}

          {type === "message_document" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Document</Label>
                <MediaUpload channel={channel} nodeType="message_document" urlKey="document_url" value={content.document_url || ""} onChange={updateContent} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Filename (shown to user)</Label>
                <Input placeholder="e.g. product_catalog.pdf" value={content.filename || ""}
                  onChange={e => updateContent("filename", e.target.value)} />
              </div>
            </div>
          )}

          {type === "message_audio" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Audio</Label>
              <MediaUpload channel={channel} nodeType="message_audio" urlKey="audio_url" value={content.audio_url || ""} onChange={updateContent} />
            </div>
          )}

          {type === "message_location" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Location details <span className="text-red-500">— name, lat & lng required</span>
              </Label>
              <Input placeholder="Location name * e.g. Our Office" value={content.name || ""}
                onChange={e => updateContent("name", e.target.value)} />
              <Input className="font-mono" placeholder="Latitude * e.g. 13.0827" value={content.latitude || ""}
                onChange={e => updateContent("latitude", e.target.value)} />
              <Input className="font-mono" placeholder="Longitude * e.g. 80.2707" value={content.longitude || ""}
                onChange={e => updateContent("longitude", e.target.value)} />
              <Input placeholder="Address (optional)" value={content.address || ""}
                onChange={e => updateContent("address", e.target.value)} />
              <p className="text-xs text-muted-foreground">Google Maps → right-click the spot → the first line copied is lat, lng.</p>
            </div>
          )}

          {type === "message_contact" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Contact details</Label>
              <Input placeholder="Contact name" value={content.contact_name || ""}
                onChange={e => updateContent("contact_name", e.target.value)} />
              <Input className="font-mono" placeholder="+91 98765 43210" value={content.contact_phone || ""}
                onChange={e => updateContent("contact_phone", e.target.value)} />
              <p className="text-xs text-muted-foreground">Sends as a WhatsApp contact card.</p>
            </div>
          )}

          {type === "time_delay" && web && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Wait duration</Label>
              <div className="flex gap-2">
                <Input type="number" min="1" className="flex-1 font-semibold"
                  max={content.delay_unit === "minutes" ? 10 : 600}
                  value={content.delay_seconds || 3}
                  onChange={e => { const max = content.delay_unit === "minutes" ? 10 : 600; updateContent("delay_seconds", Math.max(1, Math.min(parseInt(e.target.value) || 1, max))); }} />
                <Select value={content.delay_unit === "minutes" ? "minutes" : "seconds"}
                  onValueChange={v => { updateContent("delay_unit", v); if (v === "minutes" && (content.delay_seconds || 3) > 10) updateContent("delay_seconds", 10); }}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Seconds</SelectItem>
                    <SelectItem value="minutes">Minutes (max 10)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Up to 10 seconds shows a typing indicator. Longer waits continue while the visitor stays on the page (and after a reload).</p>
            </div>
          )}

          {type === "time_delay" && !web && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Wait duration</Label>
              <div className="flex gap-2">
                <Input type="number" min="1" className="flex-1 font-semibold"
                  max={content.delay_unit === "hours" ? 22 : content.delay_unit === "minutes" ? 1320 : 79200}
                  value={content.delay_seconds || 60}
                  onChange={e => { const unit = content.delay_unit || "seconds"; const max = unit === "hours" ? 22 : unit === "minutes" ? 1320 : 79200; updateContent("delay_seconds", Math.min(parseInt(e.target.value) || 1, max)); }} />
                <Select value={content.delay_unit || "seconds"}
                  onValueChange={v => { updateContent("delay_unit", v); const max = v === "hours" ? 22 : v === "minutes" ? 1320 : 79200; if ((content.delay_seconds || 60) > max) updateContent("delay_seconds", max); }}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Seconds</SelectItem>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours (max 22)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 flex items-start gap-1.5">
                <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                Max 22 hours — keeps a safe 2hr buffer before WhatsApp's 24h reply window closes.
              </p>
            </div>
          )}

          {type === "call_us" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone number</Label>
              <Input className="font-mono" placeholder="+91 98765 43210" value={content.phone || ""}
                onChange={e => updateContent("phone", e.target.value)} />
              <p className="text-xs text-muted-foreground">Tapping the button opens the phone dialer with this number pre-filled.</p>
              {web && (
                <Input placeholder="Button text (default: Call us)" maxLength={40} value={content.button_text || ""}
                  onChange={e => updateContent("button_text", e.target.value)} />
              )}
            </div>
          )}

          {type === "message_shop" && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Button text</Label>
                <Input placeholder="View Menu" value={content.button_text || "View Menu"}
                  onChange={e => updateContent("button_text", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Catalog</Label>
                <Select value={content.catalog_id || ""} onValueChange={v => updateContent("catalog_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select a catalog" /></SelectTrigger>
                  <SelectContent>
                    {(catalogs || []).map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}{!cat.is_active ? " (inactive)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!content.catalog_id && <p className="text-xs text-amber-600">Select a catalog to link this node to a menu.</p>}
              </div>
              {web ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                  On the website, visitors can browse this catalog; placing and paying for an order happens on WhatsApp. The next node runs straight away.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Connect a node after this one — it runs once payment is confirmed.</p>
              )}
            </div>
          )}

          {type === "message_booking" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Button text</Label>
              <Input placeholder="Book Appointment" value={content.button_text || "Book Appointment"}
                onChange={e => updateContent("button_text", e.target.value)} />
              <p className="text-xs text-muted-foreground">Set up your availability in the Appointments tab first.</p>
            </div>
          )}

          {type === "message_event" && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Event</Label>
                <Select value={content.event_id || ""} onValueChange={v => updateContent("event_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select an event" /></SelectTrigger>
                  <SelectContent>
                    {(events || []).map(ev => (
                      <SelectItem key={ev.id} value={ev.id}>{ev.title}{!ev.is_active ? " (inactive)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!content.event_id && <p className="text-xs text-amber-600">Select an event to link this node to.</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Message</Label>
                <Textarea rows={2} value={content.body || ""}
                  onChange={e => updateContent("body", e.target.value)}
                  placeholder="Register now — limited spots available!" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Button text</Label>
                <Input placeholder="Register Now" value={content.button_text || "Register Now"}
                  onChange={e => updateContent("button_text", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Call-to-attend phone (optional)</Label>
                <Input className="font-mono" placeholder="+91 98765 43210" value={content.contact_phone || ""}
                  onChange={e => updateContent("contact_phone", e.target.value)} />
                <p className="text-xs text-muted-foreground">If set, a second message offers a "Call to attend" button.</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
