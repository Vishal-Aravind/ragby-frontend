"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import ProjectCard from "@/components/ProjectCard";
import { NewProjectForm } from "./new/page";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [showNewProject, setShowNewProject] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/projects");

      if (res.status === 401) {
        router.replace("/login");
        return;
      }

      const data = await res.json();

      // Most accounts only ever have exactly one project (their own
      // business) — showing a "pick a project" page with a single card to
      // click is a pointless extra step. Only genuinely show this page
      // when there's a real choice to make (e.g. someone who's a team
      // member on more than one business's project).
      if (data && data.length === 1) {
        router.replace(`/dashboard/${data[0].id}`);
        return;
      }

      // Brand-new account, no project yet, and never a member of anyone
      // else's either — one project per account is enforced anyway, so
      // there's no real choice being made by asking for a name upfront.
      // Auto-create with a default (renamable in the dashboard header) and
      // skip straight to it, instead of a blocking "create project" screen.
      if (data && data.length === 0) {
        const createRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (createRes.ok) {
          const newProject = await createRes.json();
          router.replace(`/dashboard/${newProject.id}`);
          return;
        }
        // Auto-create failed (rare) — fall through to the manual "+ New
        // project" button below instead of leaving the user stuck.
      }

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
            {/* One business per account — once you own one, there's no
                second one to create. Being a team member on someone else's
                project doesn't count against this. */}
            {!projects.some(p => p.myRole === "owner") && (
              <Button onClick={() => setShowNewProject(true)}>
                + New project
              </Button>
            )}
          </div>

          {projects.length === 0 ? (
            <p className="text-muted-foreground">Create your first project</p>
          ) : (
            <div className="grid grid-cols-3 gap-6">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onDelete={(id) => setProjects(prev => prev.filter(p => p.id !== id))}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new project</DialogTitle>
          </DialogHeader>
          <NewProjectForm />
        </DialogContent>
      </Dialog>
    </div>
  );
}