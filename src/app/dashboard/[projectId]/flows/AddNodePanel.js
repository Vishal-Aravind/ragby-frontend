"use client";

// AddNodePanel.js
//
// Replaces the old two-entry-point add flow: a toolbar button that always
// dropped a blank "message" node (type picked afterward via a dropdown
// rendered INSIDE the node), plus a separate drag-only sidebar for six
// "special" node types. One panel, one list, every type has a description
// visible before you pick it — the two things new users said they couldn't
// find (where to add a node, what it does).
import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { NODE_REGISTRY, CATEGORIES } from "./nodeRegistry";

export default function AddNodePanel({ open, onOpenChange, onSelect }) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? NODE_REGISTRY.filter(n =>
          n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q))
      : NODE_REGISTRY;
    return CATEGORIES
      .map(cat => ({ category: cat, nodes: filtered.filter(n => n.category === cat) }))
      .filter(g => g.nodes.length > 0);
  }, [query]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle>Add a node</SheetTitle>
          <SheetDescription>Pick what this step should do.</SheetDescription>
          <div className="relative mt-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search node types..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {grouped.length === 0 && (
            <p className="text-sm text-muted-foreground">No node types match "{query}".</p>
          )}
          {grouped.map(({ category, nodes }) => (
            <div key={category}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {category}
              </p>
              <div className="space-y-2">
                {nodes.map(n => {
                  const Icon = n.icon;
                  return (
                    <button
                      key={n.type}
                      onClick={() => { onSelect(n.type); onOpenChange(false); setQuery(""); }}
                      className="w-full text-left flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-gray-400 hover:bg-gray-50"
                    >
                      <div
                        className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                        style={{ background: n.badge, color: n.text }}
                      >
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{n.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
