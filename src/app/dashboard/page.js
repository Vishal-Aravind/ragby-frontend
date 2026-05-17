"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import ProjectCard from "@/components/ProjectCard";
import { useRouter } from "next/navigation";
import { Loader2, Zap } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

const PLAN_COLORS = {
  free: "bg-gray-200",
  pro: "bg-blue-500",
  business: "bg-emerald-500",
};

const PLAN_LABELS = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

function UsageBar({ usage }) {
  if (!usage) return null;

  const { plan, usage: used, limit, remaining } = usage;
  const percent = Math.min((used / limit) * 100, 100);
  const isNearLimit = percent >= 80;
  const isAtLimit = percent >= 100;

  const barColor = isAtLimit
    ? "bg-red-500"
    : isNearLimit
    ? "bg-amber-400"
    : PLAN_COLORS[plan] || "bg-blue-500";

  return (
    <div className="mx-6 mb-6 bg-white border rounded-2xl px-5 py-4 flex items-center gap-6">
      {/* Plan badge */}
      <div className="shrink-0">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          plan === "business"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
            : plan === "pro"
            ? "bg-blue-50 text-blue-700 border border-blue-100"
            : "bg-gray-100 text-gray-600 border border-gray-200"
        }`}>
          {PLAN_LABELS[plan] || "Free"}
        </span>
      </div>

      {/* Bar + label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-gray-700">
            Conversations this month
          </p>
          <p className={`text-xs font-medium ${isAtLimit ? "text-red-500" : "text-gray-500"}`}>
            {used.toLocaleString()} / {limit.toLocaleString()}
          </p>
        </div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        {isNearLimit && !isAtLimit && (
          <p className="text-xs text-amber-600 mt-1">
            ⚠️ {remaining} conversations remaining this month
          </p>
        )}
        {isAtLimit && (
          <p className="text-xs text-red-500 mt-1">
            Limit reached — upgrade to continue
          </p>
        )}
      </div>

      {/* Upgrade CTA */}
      {plan === "free" && (
        <button
          onClick={() => window.location.href = "/pricing"}
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all"
        >
          <Zap size={12} />
          Upgrade
        </button>
      )}
      {plan === "pro" && isNearLimit && (
        <button
          onClick={() => window.location.href = "/pricing"}
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-all"
        >
          <Zap size={12} />
          Upgrade
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/projects");

      if (res.status === 401) {
        router.replace("/login");
        return;
      }

      const data = await res.json();
      setProjects(data || []);
      setLoading(false);
    };

    const loadUsage = async () => {
      try {
        const res = await fetch("/api/usage");
        if (res.ok) {
          const data = await res.json();
          setUsage(data);
        }
      } catch {}
    };

    load();
    loadUsage();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
        {/* Usage bar */}
        <div className="pt-6">
          <UsageBar usage={usage} />
        </div>

        <div className="px-6">
          <div className="flex justify-between mb-6">
            <h1 className="text-2xl font-semibold">Projects</h1>
            <Button onClick={() => router.push("/dashboard/new")}>
              + New project
            </Button>
          </div>

          {projects.length === 0 ? (
            <p className="text-muted-foreground">Create your first project</p>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}