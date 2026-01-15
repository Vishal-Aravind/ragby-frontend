"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import ProjectCard from "@/components/ProjectCard";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
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

    load();
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

      <main className="p-6">
        <div className="flex justify-between mb-6">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <Button onClick={() => router.push("/dashboard/new")}>
            + New project
          </Button>
        </div>

        {projects.length === 0 ? (
          <p className="text-muted-foreground">
            Create your first project
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
