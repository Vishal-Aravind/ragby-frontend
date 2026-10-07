"use client";

// WebNodeFields.js
//
// Settings for the node types that exist only in Website flows (quick
// replies, carousel, ask, form, rating, open link). Kept out of NodeConfigDialog so that file stays
// readable; the shared node types are still configured there.
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, Plus, Info, ArrowUp, ArrowDown } from "lucide-react";
import { newOptionId } from "./nodeRegistry";

const VAR_RE = /^[a-z][a-z0-9_]{0,31}$/;
const cleanVar = (v) => (v || "").toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^[^a-z]+/, "").slice(0, 32);
const clone = (v) => JSON.parse(JSON.stringify(v || []));

export function VariableChips({ variables, onInsert }) {
  if (!variables?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 items-center">
      <span className="text-[11px] text-muted-foreground mr-1">Insert:</span>
      {variables.map(v => (
        <button key={v} type="button" onClick={() => onInsert(`{{${v}}}`)}
          className="text-[11px] px-1.5 py-0.5 rounded border bg-gray-50 hover:bg-gray-100 font-mono">
          {`{{${v}}}`}
        </button>
      ))}
    </div>
  );
}

function VarInput({ value, onChange, placeholder = "variable_name" }) {
  const bad = value && !VAR_RE.test(value);
  return (
    <div className="flex-1">
      <Input className="font-mono text-xs" placeholder={placeholder} value={value || ""}
        onChange={e => onChange(cleanVar(e.target.value))} />
      {bad && <p className="text-[11px] text-red-600 mt-0.5">Lowercase letters, numbers and _ only.</p>}
    </div>
  );
}

function OptionList({ items, onChange, max, addLabel, prefix = "o", maxLength = 40 }) {
  const update = (idx, patch) => { const n = clone(items); n[idx] = { ...n[idx], ...patch }; onChange(n); };
  const remove = (idx) => { const n = clone(items); n.splice(idx, 1); onChange(n); };
  const move = (idx, dir) => {
    const n = clone(items); const j = idx + dir;
    if (j < 0 || j >= n.length) return;
    [n[idx], n[j]] = [n[j], n[idx]]; onChange(n);
  };
  return (
    <div className="space-y-1.5">
      {(items || []).map((o, idx) => (
        <div key={o.id || idx} className="flex gap-1 items-center">
          <Input value={o.label || ""} maxLength={maxLength} placeholder={`Option ${idx + 1}`}
            onChange={e => update(idx, { label: e.target.value })} />
          <button type="button" onClick={() => move(idx, -1)} className="text-gray-400 shrink-0" aria-label="Move up"><ArrowUp size={14} /></button>
          <button type="button" onClick={() => move(idx, 1)} className="text-gray-400 shrink-0" aria-label="Move down"><ArrowDown size={14} /></button>
          <button type="button" onClick={() => remove(idx)} className="text-red-400 shrink-0" aria-label="Remove"><X size={15} /></button>
        </div>
      ))}
      {(items || []).length < max && (
        <Button variant="outline" size="sm" className="w-full"
          onClick={() => onChange([...(items || []), { id: newOptionId(prefix), label: `Option ${(items || []).length + 1}` }])}>
          <Plus size={13} className="mr-1" /> {addLabel}
        </Button>
      )}
    </div>
  );
}

export default function WebNodeFields({ type, content, updateContent, ImageField, channel = "web" }) {
  const c = content || {};

  if (type === "quick_replies") {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Options</Label>
          <OptionList items={c.options} onChange={v => updateContent("options", v)} max={50} addLabel="Add option" />
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Info size={11} /> Drag from each option&apos;s dot on the canvas to connect it.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Save the choice as a variable (optional)</Label>
          <VarInput value={c.var} onChange={v => updateContent("var", v)} placeholder="e.g. interest" />
        </div>
      </div>
    );
  }

  if (type === "carousel") {
    const cards = c.cards || [];
    const setCards = (n) => updateContent("cards", n);
    const updCard = (i, patch) => { const n = clone(cards); n[i] = { ...n[i], ...patch }; setCards(n); };
    return (
      <div className="space-y-3">
        {cards.map((card, i) => (
          <div key={i} className="border rounded-lg p-3 space-y-2 bg-gray-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Card {i + 1}</span>
              <button type="button" onClick={() => { const n = clone(cards); n.splice(i, 1); setCards(n); }} className="text-red-400"><X size={14} /></button>
            </div>
            <Input placeholder="Title" maxLength={80} value={card.title || ""} onChange={e => updCard(i, { title: e.target.value })} />
            <Textarea rows={2} placeholder="Short description (optional)" maxLength={300} value={card.text || ""} onChange={e => updCard(i, { text: e.target.value })} />
            <ImageField value={card.image || ""} onChange={(v) => updCard(i, { image: v })} />
            <Label className="text-xs text-muted-foreground">Buttons (max 3)</Label>
            {(card.buttons || []).map((b, bi) => (
              <div key={b.id || bi} className="flex gap-1 items-center">
                <Input className="flex-1" placeholder="Label" maxLength={40} value={b.label || ""}
                  onChange={e => { const n = clone(card.buttons); n[bi] = { ...n[bi], label: e.target.value }; updCard(i, { buttons: n }); }} />
                <Input className="flex-1 font-mono text-xs" placeholder="Link (optional)" value={b.url || ""}
                  onChange={e => { const n = clone(card.buttons); n[bi] = { ...n[bi], url: e.target.value }; updCard(i, { buttons: n }); }} />
                <button type="button" onClick={() => { const n = clone(card.buttons); n.splice(bi, 1); updCard(i, { buttons: n }); }} className="text-red-400"><X size={14} /></button>
              </div>
            ))}
            {(card.buttons || []).length < 3 && (
              <Button variant="outline" size="sm" className="w-full"
                onClick={() => updCard(i, { buttons: [...(card.buttons || []), { id: newOptionId("c"), label: "Choose" }] })}>
                <Plus size={13} className="mr-1" /> Add button
              </Button>
            )}
          </div>
        ))}
        {cards.length < 10 && (
          <Button variant="outline" size="sm" className="w-full"
            onClick={() => setCards([...cards, { title: `Card ${cards.length + 1}`, text: "", image: "", buttons: [{ id: newOptionId("c"), label: "Choose" }] }])}>
            <Plus size={13} className="mr-1" /> Add card
          </Button>
        )}
        <p className="text-xs text-muted-foreground flex items-center gap-1"><Info size={11} /> A button with a link opens it; a button without one continues the flow (connect its dot on the canvas).</p>
      </div>
    );
  }

  if (type === "ask_input") {
    const t = c.input_type || "text";
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Answer type</Label>
            <Select value={t} onValueChange={v => updateContent("input_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {/* No date on WhatsApp: people type dates every which way in a chat. */}
                {(channel === "whatsapp" ? ["text", "email", "phone", "number"] : ["text", "email", "phone", "number", "date"])
                  .map(x => <SelectItem key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Save answer as</Label>
            <VarInput value={c.var} onChange={v => updateContent("var", v)} placeholder="e.g. name" />
          </div>
        </div>
        {channel !== "whatsapp" && (
          <Input placeholder="Placeholder (optional)" value={c.placeholder || ""} maxLength={80} onChange={e => updateContent("placeholder", e.target.value)} />
        )}
        {(t === "number" || t === "date") && (
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder={t === "date" ? "Earliest (today, today+1, 2026-12-31)" : "Minimum"} value={c.min ?? ""} onChange={e => updateContent("min", e.target.value)} />
            <Input placeholder={t === "date" ? "Latest (optional)" : "Maximum"} value={c.max ?? ""} onChange={e => updateContent("max", e.target.value)} />
          </div>
        )}
        {channel === "whatsapp" ? (
          <p className="text-xs text-muted-foreground">The customer types the answer. If it doesn&apos;t fit (e.g. not an email), the bot asks again. Saved as <code>name</code> or <code>email</code> it also updates the contact in Leads.</p>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={c.required !== false} onCheckedChange={v => updateContent("required", v)} /> Required
          </label>
        )}
      </div>
    );
  }

  if (type === "form") {
    const fields = c.fields || [];
    const setFields = (n) => updateContent("fields", n);
    const upd = (i, patch) => { const n = clone(fields); n[i] = { ...n[i], ...patch }; setFields(n); };
    return (
      <div className="space-y-3">
        <Input placeholder="Form title (optional)" maxLength={120} value={c.title || ""} onChange={e => updateContent("title", e.target.value)} />
        {fields.map((f, i) => (
          <div key={i} className="border rounded-lg p-2.5 space-y-1.5 bg-gray-50/50">
            <div className="flex gap-1.5 items-center">
              <Input className="flex-1" placeholder="Label shown to visitor" maxLength={80} value={f.label || ""} onChange={e => upd(i, { label: e.target.value })} />
              <button type="button" onClick={() => { const n = clone(fields); n.splice(i, 1); setFields(n); }} className="text-red-400"><X size={14} /></button>
            </div>
            <div className="flex gap-1.5 items-start">
              <Select value={f.type || "text"} onValueChange={v => upd(i, { type: v })}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["text", "email", "phone", "number", "date", "choice", "consent"].map(x => <SelectItem key={x} value={x}>{x === "consent" ? "Consent tick" : x[0].toUpperCase() + x.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
              <VarInput value={f.name} onChange={v => upd(i, { name: v })} placeholder="saves as" />
              <label className="flex items-center gap-1 text-xs whitespace-nowrap pt-2">
                <Switch checked={f.required !== false} onCheckedChange={v => upd(i, { required: v })} /> Req.
              </label>
            </div>
            {f.type === "choice" && (
              <Input placeholder="Choices, comma separated" value={(f.options || []).join(", ")}
                onChange={e => upd(i, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean).slice(0, 20) })} />
            )}
          </div>
        ))}
        {fields.length < 10 && (
          <Button variant="outline" size="sm" className="w-full"
            onClick={() => setFields([...fields, { name: `field_${fields.length + 1}`, type: "text", label: "", required: false }])}>
            <Plus size={13} className="mr-1" /> Add field
          </Button>
        )}
        <Input placeholder="Button text" maxLength={30} value={c.submit_label || ""} onChange={e => updateContent("submit_label", e.target.value)} />
        <label className="flex items-start gap-2 text-sm">
          <Switch checked={!!c.save_lead} onCheckedChange={v => updateContent("save_lead", v)} />
          <span>Save to Leads<span className="block text-xs text-muted-foreground">Fields saved as <code>name</code>, <code>email</code> and <code>phone</code> fill the lead; others are kept as extra details. Needs an email or phone.</span></span>
        </label>
      </div>
    );
  }

  if (type === "rating") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Style</Label>
          <Select value={c.style || "stars"} onValueChange={v => updateContent("style", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stars">1-5 stars</SelectItem>
              <SelectItem value="nps">0-10 score</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Save as</Label>
          <VarInput value={c.var} onChange={v => updateContent("var", v)} placeholder="rating" />
        </div>
      </div>
    );
  }

  if (type === "open_url") {
    return (
      <div className="space-y-2">
        <Input placeholder="Button text" maxLength={40} value={c.button_text || ""} onChange={e => updateContent("button_text", e.target.value)} />
        <Input className="font-mono text-xs" placeholder="https://... or mailto:you@shop.com" value={c.url || ""} onChange={e => updateContent("url", e.target.value)} />
        <p className="text-xs text-muted-foreground">You can use variables in the link, e.g. https://shop.com/track?id={"{{order_id}}"}</p>
      </div>
    );
  }

  return null;
}

