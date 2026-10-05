"use client";

// WebNodeFields.js
//
// Settings for the node types that exist only in Website flows (quick
// replies, carousel, ask, form, rating, set variable, condition, webhook,
// random split, open link). Kept out of NodeConfigDialog so that file stays
// readable; the shared node types are still configured there.
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, Plus, Info, ArrowUp, ArrowDown, Loader2, Eye, EyeOff } from "lucide-react";
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

const OPS = [
  ["equals", "is"], ["not_equals", "is not"], ["contains", "contains"], ["not_contains", "doesn't contain"],
  ["starts_with", "starts with"], ["gt", ">"], ["gte", ">="], ["lt", "<"], ["lte", "<="],
  ["is_empty", "is empty"], ["not_empty", "has a value"],
];

export default function WebNodeFields({ type, content, updateContent, variables, flowId, ImageField }) {
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
                {["text", "email", "phone", "number", "date"].map(x => <SelectItem key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Save answer as</Label>
            <VarInput value={c.var} onChange={v => updateContent("var", v)} placeholder="e.g. name" />
          </div>
        </div>
        <Input placeholder="Placeholder (optional)" value={c.placeholder || ""} maxLength={80} onChange={e => updateContent("placeholder", e.target.value)} />
        {(t === "number" || t === "date") && (
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder={t === "date" ? "Earliest (today, today+1, 2026-12-31)" : "Minimum"} value={c.min ?? ""} onChange={e => updateContent("min", e.target.value)} />
            <Input placeholder={t === "date" ? "Latest (optional)" : "Maximum"} value={c.max ?? ""} onChange={e => updateContent("max", e.target.value)} />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={c.required !== false} onCheckedChange={v => updateContent("required", v)} /> Required
        </label>
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

  if (type === "set_variable") {
    const rows = c.assignments || [];
    const upd = (i, patch) => { const n = clone(rows); n[i] = { ...n[i], ...patch }; updateContent("assignments", n); };
    return (
      <div className="space-y-2">
        {rows.map((a, i) => (
          <div key={i} className="flex gap-1.5 items-start">
            <VarInput value={a.var} onChange={v => upd(i, { var: v })} />
            <span className="pt-2 text-sm">=</span>
            <Input className="flex-1" placeholder="Value or {{other_variable}}" value={a.value || ""} onChange={e => upd(i, { value: e.target.value })} />
            <button type="button" onClick={() => { const n = clone(rows); n.splice(i, 1); updateContent("assignments", n); }} className="text-red-400 pt-2"><X size={14} /></button>
          </div>
        ))}
        {rows.length < 20 && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => updateContent("assignments", [...rows, { var: "", value: "" }])}>
            <Plus size={13} className="mr-1" /> Add
          </Button>
        )}
      </div>
    );
  }

  if (type === "condition") {
    const rules = c.rules || [];
    const setRules = (n) => updateContent("rules", n);
    const updRule = (i, patch) => { const n = clone(rules); n[i] = { ...n[i], ...patch }; setRules(n); };
    const move = (i, dir) => { const n = clone(rules); const j = i + dir; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setRules(n); };
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Rules are checked top to bottom; the first one that matches decides the path. If none match, the <b>Else</b> path is used.</p>
        {rules.map((r, i) => (
          <div key={r.id || i} className="border rounded-lg p-2.5 space-y-2 bg-gray-50/50">
            <div className="flex items-center gap-1.5">
              <Input className="flex-1" placeholder={`Rule ${i + 1} name (optional)`} maxLength={40} value={r.name || ""} onChange={e => updRule(i, { name: e.target.value })} />
              <Select value={r.match || "all"} onValueChange={v => updRule(i, { match: v })}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All match</SelectItem>
                  <SelectItem value="any">Any match</SelectItem>
                </SelectContent>
              </Select>
              <button type="button" onClick={() => move(i, -1)} className="text-gray-400"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => move(i, 1)} className="text-gray-400"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => { const n = clone(rules); n.splice(i, 1); setRules(n); }} className="text-red-400"><X size={14} /></button>
            </div>
            {(r.rows || []).map((row, ri) => {
              const updRow = (patch) => { const rows = clone(r.rows); rows[ri] = { ...rows[ri], ...patch }; updRule(i, { rows }); };
              const noValue = row.op === "is_empty" || row.op === "not_empty";
              return (
                <div key={ri} className="flex gap-1 items-center">
                  <Select value={row.var || ""} onValueChange={v => updRow({ var: v })}>
                    <SelectTrigger className="w-32 font-mono text-xs"><SelectValue placeholder="variable" /></SelectTrigger>
                    <SelectContent>
                      {(variables || []).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={row.op || "equals"} onValueChange={v => updRow({ op: v })}>
                    <SelectTrigger className="w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{OPS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                  {!noValue && <Input className="flex-1 text-xs" placeholder="value" value={row.value || ""} onChange={e => updRow({ value: e.target.value })} />}
                  <button type="button" onClick={() => { const rows = clone(r.rows); rows.splice(ri, 1); updRule(i, { rows }); }} className="text-red-400"><X size={13} /></button>
                </div>
              );
            })}
            {(r.rows || []).length < 10 && (
              <button type="button" className="text-xs text-blue-600" onClick={() => updRule(i, { rows: [...(r.rows || []), { var: "", op: "equals", value: "" }] })}>+ Add check</button>
            )}
          </div>
        ))}
        {rules.length < 20 && (
          <Button variant="outline" size="sm" className="w-full"
            onClick={() => setRules([...rules, { id: newOptionId("r"), name: "", match: "all", rows: [{ var: "", op: "equals", value: "" }] }])}>
            <Plus size={13} className="mr-1" /> Add rule
          </Button>
        )}
        {!(variables || []).length && <p className="text-xs text-amber-700">No variables yet - add an Ask, Form, Rating or Set variable node first.</p>}
      </div>
    );
  }

  if (type === "random_split") {
    const branches = c.branches || [];
    const total = branches.reduce((n, b) => n + (Number(b.weight) || 0), 0);
    const upd = (i, patch) => { const n = clone(branches); n[i] = { ...n[i], ...patch }; updateContent("branches", n); };
    return (
      <div className="space-y-2">
        {branches.map((b, i) => (
          <div key={b.id || i} className="flex gap-1.5 items-center">
            <Input className="flex-1" placeholder={`Branch ${i + 1}`} maxLength={30} value={b.label || ""} onChange={e => upd(i, { label: e.target.value })} />
            <Input className="w-20" type="number" min={0} max={100} value={b.weight ?? 0} onChange={e => upd(i, { weight: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) })} />
            <span className="text-sm">%</span>
            {branches.length > 2 && <button type="button" onClick={() => { const n = clone(branches); n.splice(i, 1); updateContent("branches", n); }} className="text-red-400"><X size={14} /></button>}
          </div>
        ))}
        {branches.length < 5 && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => updateContent("branches", [...branches, { id: newOptionId("b"), label: String.fromCharCode(65 + branches.length), weight: 0 }])}>
            <Plus size={13} className="mr-1" /> Add branch
          </Button>
        )}
        <p className={`text-xs ${total === 100 ? "text-muted-foreground" : "text-red-600"}`}>Total: {total}% {total !== 100 && "- must add up to 100%"}</p>
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

  if (type === "webhook") return <WebhookFields c={c} updateContent={updateContent} variables={variables} flowId={flowId} />;
  return null;
}

function KeyValueRows({ rows, onChange, keyPlaceholder, valuePlaceholder, secret, max }) {
  const [shown, setShown] = useState({});
  const upd = (i, patch) => { const n = clone(rows); n[i] = { ...n[i], ...patch }; onChange(n); };
  return (
    <div className="space-y-1.5">
      {(rows || []).map((r, i) => (
        <div key={i} className="flex gap-1 items-center">
          <Input className="w-36 font-mono text-xs" placeholder={keyPlaceholder} value={r.key || ""} onChange={e => upd(i, { key: e.target.value })} />
          <Input className="flex-1 font-mono text-xs" placeholder={valuePlaceholder} value={r.value || ""}
            type={secret && !shown[i] ? "password" : "text"} autoComplete="off"
            onChange={e => upd(i, { value: e.target.value })} />
          {secret && (
            <button type="button" className="text-gray-400" onClick={() => setShown(s => ({ ...s, [i]: !s[i] }))}>
              {shown[i] ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
          <button type="button" onClick={() => { const n = clone(rows); n.splice(i, 1); onChange(n); }} className="text-red-400"><X size={14} /></button>
        </div>
      ))}
      {(rows || []).length < max && (
        <button type="button" className="text-xs text-blue-600" onClick={() => onChange([...(rows || []), { key: "", value: "" }])}>+ Add</button>
      )}
    </div>
  );
}

function WebhookFields({ c, updateContent, variables, flowId }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const runTest = async () => {
    setTesting(true); setResult(null);
    const sample = Object.fromEntries((variables || []).map(v => [v, `sample_${v}`]));
    try {
      const res = await fetch(`/api/flows/${flowId}/test-webhook`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: c, variables: sample }),
      });
      const d = await res.json().catch(() => ({}));
      setResult(res.ok ? d : { ok: false, reason: d.detail || d.error || "Test failed." });
    } catch {
      setResult({ ok: false, reason: "Could not reach the server." });
    }
    setTesting(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={c.method || "POST"} onValueChange={v => updateContent("method", v)}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>{["GET", "POST", "PUT", "PATCH"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="flex-1 font-mono text-xs" placeholder="https://your-system.com/hook" value={c.url || ""} onChange={e => updateContent("url", e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Headers (values are hidden; e.g. Authorization)</Label>
        <KeyValueRows rows={c.headers} onChange={v => updateContent("headers", v)} keyPlaceholder="Header" valuePlaceholder="Value" secret max={10} />
      </div>
      {(c.method || "POST") !== "GET" && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">JSON body - values can use {"{{variables}}"}</Label>
          <KeyValueRows rows={c.body} onChange={v => updateContent("body", v)} keyPlaceholder="key" valuePlaceholder="{{email}}" max={30} />
          <label className="flex items-center gap-2 text-xs">
            <Switch checked={!!c.include_all_vars} onCheckedChange={v => updateContent("include_all_vars", v)} /> Also send every variable collected so far
          </label>
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Save from the response (JSON path → variable)</Label>
        {(c.mappings || []).map((m, i) => (
          <div key={i} className="flex gap-1 items-start">
            <Input className="flex-1 font-mono text-xs" placeholder="data.customer.tier" value={m.path || ""}
              onChange={e => { const n = clone(c.mappings); n[i] = { ...n[i], path: e.target.value }; updateContent("mappings", n); }} />
            <span className="pt-2 text-xs">→</span>
            <VarInput value={m.var} onChange={v => { const n = clone(c.mappings); n[i] = { ...n[i], var: v }; updateContent("mappings", n); }} />
            <button type="button" className="text-red-400 pt-2" onClick={() => { const n = clone(c.mappings); n.splice(i, 1); updateContent("mappings", n); }}><X size={14} /></button>
          </div>
        ))}
        {(c.mappings || []).length < 20 && (
          <button type="button" className="text-xs text-blue-600" onClick={() => updateContent("mappings", [...(c.mappings || []), { path: "", var: "" }])}>+ Add</button>
        )}
      </div>
      <Input placeholder={'Message while waiting (optional), e.g. "One moment..."'} maxLength={200} value={c.waiting_text || ""} onChange={e => updateContent("waiting_text", e.target.value)} />
      <div className="space-y-1.5">
        <Button type="button" variant="outline" size="sm" onClick={runTest} disabled={testing || !c.url}>
          {testing ? <Loader2 size={13} className="animate-spin mr-1" /> : null} Test request
        </Button>
        {result && (
          <div className={`text-xs rounded-md border px-2 py-1.5 ${result.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>
            <div>{result.ok ? `Success (${result.status})` : result.reason || `Failed (${result.status ?? "no response"})`}</div>
            {result.assign && Object.keys(result.assign).length > 0 && (
              <div className="mt-1 font-mono">{Object.entries(result.assign).map(([k, v]) => `${k} = ${String(v)}`).join(", ")}</div>
            )}
            {result.preview && <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px]">{result.preview}</pre>}
          </div>
        )}
        <p className="text-xs text-muted-foreground flex items-start gap-1"><Info size={11} className="mt-0.5 shrink-0" /> Connect both paths on the canvas: <b>Success</b> (2xx reply) and <b>Failure</b> (error, timeout). Test sends sample values.</p>
      </div>
    </div>
  );
}
