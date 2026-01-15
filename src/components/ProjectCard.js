"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

export default function ProjectCard({ project }) {
  const router = useRouter();

  return (
    <Card
      onClick={() => router.push(`/dashboard/${project.id}`)}
      className="cursor-pointer hover:border-primary transition"
    >
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg truncate">
            {project.name}
          </h2>
          <span className="text-muted-foreground">›</span>
        </div>

        <p className="text-sm text-muted-foreground">Company: </p>

        <div className="pt-2">
          <span className="inline-block text-xs border rounded px-2 py-0.5">
            {project.intent}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
