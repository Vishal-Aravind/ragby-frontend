"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Users, MessageSquare, CreditCard, TrendingUp } from "lucide-react";

// ── Add your email here — only this email can access admin ──
const ADMIN_EMAIL = "khavinprakash03@gmail.com";

const PLAN_COLORS = {
  free: "bg-gray-100 text-gray-600",
  pro: "bg-blue-50 text-blue-700",
  business: "bg-emerald-50 text-emerald-700",
};

const PLAN_LIMITS = {
  free: 300,
  pro: 5000,
  business: 25000,
};

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white border rounded-2xl px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [sortBy, setSortBy] = useState("usage_desc");

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 401 || res.status === 403) {
        setUnauthorized(true);
        return;
      }
      const data = await res.json();
      setUsers(data || []);
    } catch {
      setUnauthorized(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = users
    .filter(u => {
      const matchSearch = u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.name?.toLowerCase().includes(search.toLowerCase());
      const matchPlan = planFilter === "all" || u.plan === planFilter;
      return matchSearch && matchPlan;
    })
    .sort((a, b) => {
      if (sortBy === "usage_desc") return (b.usage || 0) - (a.usage || 0);
      if (sortBy === "usage_asc") return (a.usage || 0) - (b.usage || 0);
      if (sortBy === "joined_desc") return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === "joined_asc") return new Date(a.created_at) - new Date(b.created_at);
      return 0;
    });

  // Stats
  const totalUsers = users.length;
  const paidUsers = users.filter(u => u.plan !== "free").length;
  const totalMessages = users.reduce((sum, u) => sum + (u.usage || 0), 0);
  const mrr = users.reduce((sum, u) => {
    if (u.plan === "pro") return sum + 14;
    if (u.plan === "business") return sum + 27;
    return sum;
  }, 0);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );

  if (unauthorized) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-lg font-medium">Access denied</p>
        <p className="text-sm text-muted-foreground mt-1">You don't have permission to view this page.</p>
        <button onClick={() => router.push("/dashboard")} className="mt-4 text-sm text-blue-600">
          Back to dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="h-14 border-b bg-white px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="font-semibold text-sm">askzavo</button>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border">Admin</span>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total users" value={totalUsers} color="bg-blue-50 text-blue-600" />
          <StatCard icon={CreditCard} label="Paid users" value={paidUsers} sub={`${totalUsers - paidUsers} free`} color="bg-emerald-50 text-emerald-600" />
          <StatCard icon={MessageSquare} label="Messages this month" value={totalMessages.toLocaleString()} color="bg-purple-50 text-purple-600" />
          <StatCard icon={TrendingUp} label="Est. MRR" value={`$${mrr}`} sub="from active subscriptions" color="bg-amber-50 text-amber-600" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white w-64 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
          >
            <option value="all">All plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="business">Business</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
          >
            <option value="usage_desc">Highest usage</option>
            <option value="usage_asc">Lowest usage</option>
            <option value="joined_desc">Newest first</option>
            <option value="joined_asc">Oldest first</option>
          </select>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} users</span>
        </div>

        {/* Users table */}
        <div className="bg-white border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Plan</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Usage this month</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Projects</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Joined</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Razorpay</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground text-sm">
                    No users found
                  </td>
                </tr>
              ) : (
                filtered.map((user) => {
                  const limit = PLAN_LIMITS[user.plan] || 300;
                  const usage = user.usage || 0;
                  const percent = Math.min((usage / limit) * 100, 100);
                  const isNearLimit = percent >= 80;
                  const isAtLimit = percent >= 100;

                  return (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      {/* User */}
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900">{user.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </td>

                      {/* Plan */}
                      <td className="px-5 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${PLAN_COLORS[user.plan] || PLAN_COLORS.free}`}>
                          {user.plan || "free"}
                        </span>
                      </td>

                      {/* Usage */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0 w-32">
                            <div className="flex justify-between text-xs mb-1">
                              <span className={isAtLimit ? "text-red-500 font-medium" : "text-gray-600"}>
                                {usage.toLocaleString()}
                              </span>
                              <span className="text-muted-foreground">{limit.toLocaleString()}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isAtLimit ? "bg-red-500" : isNearLimit ? "bg-amber-400" : "bg-blue-500"
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                          {isAtLimit && <span className="text-xs text-red-500 shrink-0">Limit hit</span>}
                          {isNearLimit && !isAtLimit && <span className="text-xs text-amber-500 shrink-0">80%+</span>}
                        </div>
                      </td>

                      {/* Projects */}
                      <td className="px-5 py-4">
                        <span className="text-gray-700">{user.project_count || 0}</span>
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-4 text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Razorpay */}
                      <td className="px-5 py-4">
                        {user.razorpay_customer_id ? (
                          <a
                            href={`https://dashboard.razorpay.com/app/customers/${user.razorpay_customer_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View →
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </main>
    </div>
  );
}