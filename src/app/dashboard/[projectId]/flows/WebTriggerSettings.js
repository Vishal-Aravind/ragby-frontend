"use client";

// WebTriggerSettings.js
//
// Settings for a website flow: whether it starts when the chat is opened,
// and auto-open triggers (time on page, page URL, exit intent, scroll) with
// the guards that stop it from being annoying.
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, Plus, Loader2 } from "lucide-react";

const TRIGGERS = {
  time_on_page: "After time on page",
  url_match: "On a specific page",
  exit_intent: "When leaving the page (desktop)",
  scroll_depth: "After scrolling",
};

export default function WebTriggerSettings({ initial, saving, onSave, onClose }) {
  const [s, setS] = useState(() => ({
    start_on_open: initial?.start_on_open !== false,
    display: initial?.display || "open",
    teaser: initial?.teaser || "",
    cooldown_hours: initial?.cooldown_hours ?? 24,
    suppress_days: initial?.suppress_days ?? 7,
    triggers: initial?.triggers || [],
  }));
  const set = (patch) => setS(v => ({ ...v, ...patch }));
  const setTrigger = (i, patch) => set({ triggers: s.triggers.map((t, j) => j === i ? { ...t, ...patch } : t) });

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-2 text-sm">
        <Switch checked={s.start_on_open} onCheckedChange={v => set({ start_on_open: v })} />
        <span>Start this flow when a visitor opens the chat
          <span className="block text-xs text-muted-foreground">Off: the chat opens as usual and the flow starts with their first message.</span></span>
      </label>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Open the chat automatically (any one of these)</Label>
        {s.triggers.map((t, i) => (
          <div key={i} className="flex gap-1.5 items-center">
            <Select value={t.type} onValueChange={v => setTrigger(i, { type: v })}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TRIGGERS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
            {t.type === "time_on_page" && (<><Input className="w-20" type="number" min={1} max={600} value={t.seconds ?? 10} onChange={e => setTrigger(i, { seconds: e.target.value })} /><span className="text-xs">sec</span></>)}
            {t.type === "scroll_depth" && (<><Input className="w-20" type="number" min={10} max={100} value={t.percent ?? 50} onChange={e => setTrigger(i, { percent: e.target.value })} /><span className="text-xs">%</span></>)}
            {t.type === "url_match" && (
              <>
                <Select value={t.match || "contains"} onValueChange={v => setTrigger(i, { match: v })}>
                  <SelectTrigger className="w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="starts_with">starts with</SelectItem>
                    <SelectItem value="equals">is exactly</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="flex-1 font-mono text-xs" placeholder="/pricing" value={t.value || ""} onChange={e => setTrigger(i, { value: e.target.value })} />
              </>
            )}
            <button type="button" className="text-red-400 ml-auto" onClick={() => set({ triggers: s.triggers.filter((_, j) => j !== i) })}><X size={14} /></button>
          </div>
        ))}
        {s.triggers.length < 10 && (
          <Button variant="outline" size="sm" onClick={() => set({ triggers: [...s.triggers, { type: "time_on_page", seconds: 15 }] })}>
            <Plus size={13} className="mr-1" /> Add trigger
          </Button>
        )}
      </div>

      {s.triggers.length > 0 && (
        <div className="space-y-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">How it appears</Label>
              <Select value={s.display} onValueChange={v => set({ display: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open the chat</SelectItem>
                  <SelectItem value="teaser">Small message bubble</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bubble text</Label>
              <Input maxLength={140} placeholder="Hi! Need any help?" value={s.teaser} onChange={e => set({ teaser: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Wait before showing again (hours)</Label>
              <Input type="number" min={0} max={720} value={s.cooldown_hours} onChange={e => set({ cooldown_hours: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">If closed, don&apos;t show for (days)</Label>
              <Input type="number" min={0} max={90} value={s.suppress_days} onChange={e => set({ suppress_days: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Never more than once per visit. Phones always get the small bubble instead of a full-screen chat. Nothing opens while a visitor is already chatting.</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" disabled={saving} onClick={() => onSave(s)}>
          {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null} Save settings
        </Button>
      </div>
    </div>
  );
}
