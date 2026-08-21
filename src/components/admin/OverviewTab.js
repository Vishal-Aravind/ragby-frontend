"use client";
import { useEffect, useState } from "react";
import { Users, Building2, DollarSign, MessageSquare, Ban } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import StatCard from "./StatCard";

export default function OverviewTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>;
  if (!data) return <div className="text-sm text-muted-foreground py-8 text-center">Failed to load.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total users" value={data.totalUsers.toLocaleString()} color="blue" />
        <StatCard icon={Building2} label="Total tenants" value={data.totalProjects.toLocaleString()}
          sublabel={data.suspendedProjects > 0 ? `${data.suspendedProjects} suspended` : undefined} color="purple" />
        <StatCard icon={DollarSign} label="Est. MRR" value={`$${data.mrrEstimate.toLocaleString()}`}
          sublabel="assumes monthly billing" color="emerald" />
        <StatCard icon={MessageSquare} label="Messages this month" value={data.messagesThisMonth.toLocaleString()} color="amber" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {["free", "pro", "business"].map(plan => (
          <div key={plan} className="bg-white border rounded-2xl px-5 py-4">
            <p className="text-xs text-muted-foreground font-medium capitalize mb-1">{plan} plan</p>
            <p className="text-xl font-bold text-gray-900">{data.planCounts[plan] || 0}</p>
          </div>
        ))}
      </div>

      {data.suspendedProjects > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <Ban size={15} />
          {data.suspendedProjects} tenant{data.suspendedProjects > 1 ? "s" : ""} currently suspended — see Tenants tab.
        </div>
      )}

      <div className="bg-white border rounded-2xl p-4">
        <h3 className="text-sm font-semibold mb-4">Signups &amp; messages (last 14 days)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.trend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => {
              const date = new Date(d);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={d => new Date(d).toLocaleDateString()} />
            <Bar dataKey="signups" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Signups" />
            <Bar dataKey="messages" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Messages" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 justify-center">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Signups
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-purple-500 inline-block" /> Messages
          </span>
        </div>
      </div>
    </div>
  );
}
