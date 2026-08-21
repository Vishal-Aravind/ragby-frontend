"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ACTION_LABELS = {
  plan_override: "Plan override",
  suspend: "Suspended tenant",
  reactivate: "Reactivated tenant",
  view_as_start: "Started view-as session",
};

export default function AuditLogTab() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ entries: [], hasMore: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/audit-log?page=${page}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [page]);

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">Staff</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">Target</th>
              <th className="px-4 py-2.5 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : data.entries.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No admin actions recorded yet.</td></tr>
            ) : (
              data.entries.map(e => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-gray-800">{e.staff?.email || e.staff_user_id}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                      {ACTION_LABELS[e.action] || e.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.target_type ? `${e.target_type}:${e.target_id}` : "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                    {e.metadata && Object.keys(e.metadata).length > 0 ? JSON.stringify(e.metadata) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="text-sm border rounded-lg px-3 py-1.5 disabled:opacity-40 flex items-center gap-1"
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <span className="text-sm text-muted-foreground">Page {page + 1}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={!data.hasMore}
          className="text-sm border rounded-lg px-3 py-1.5 disabled:opacity-40 flex items-center gap-1"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
