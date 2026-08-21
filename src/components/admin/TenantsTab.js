"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Ban, ChevronLeft, ChevronRight } from "lucide-react";

export default function TenantsTab() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ tenants: [], hasMore: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      fetch(`/api/admin/tenants?q=${encodeURIComponent(q)}&page=${page}`)
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false); });
    }, 250);
    return () => clearTimeout(handle);
  }, [q, page]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setPage(0); }}
          placeholder="Search by tenant name, owner email or name..."
          className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Tenant</th>
              <th className="px-4 py-2.5 font-medium">Owner</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Usage this month</th>
              <th className="px-4 py-2.5 font-medium">Team</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : data.tenants.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No tenants found.</td></tr>
            ) : (
              data.tenants.map(t => (
                <tr
                  key={t.id}
                  className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/admin/tenants/${t.id}`)}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-900">{t.name || "Untitled"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.owner?.email || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full capitalize">{t.owner?.plan || "free"}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.usageThisMonth.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{t.teamSize}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">
                    {t.suspended ? (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit">
                        <Ban size={10} /> Suspended
                      </span>
                    ) : (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                    )}
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
