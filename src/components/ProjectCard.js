"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import AppAlertDialog from "@/components/alertdialog";

export default function ProjectCard({ project, onDelete }) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwner = (project.myRole || "owner") === "owner";

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      onDelete?.(project.id);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <Card
        onClick={() => router.push(`/dashboard/${project.id}`)}
        className="cursor-pointer hover:border-primary transition relative group"
      >
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg truncate">{project.name}</h2>

            {/* Delete button — owner only, shows on hover */}
            {isOwner && (
              <button
                onClick={(e) => {
                  e.stopPropagation(); // prevent card click
                  setDeleteDialogOpen(true);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>

          {project.domain && (
            <p className="text-sm text-muted-foreground">{project.domain}</p>
          )}

          <div className="pt-1 flex items-center gap-2">
            <span className="inline-block text-xs border rounded px-2 py-0.5 text-muted-foreground">
              {project.domain || "No domain"}
            </span>
            {!isOwner && (
              <span className="inline-block text-xs border rounded px-2 py-0.5 text-blue-600 border-blue-200 bg-blue-50 capitalize">
                {project.myRole}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <AppAlertDialog
        open={deleteDialogOpen}
        title="Delete project?"
        description={
          <>
            <strong>{project.name}</strong> will be permanently deleted including all documents, data sources and chat history. This cannot be undone.
          </>
        }
        confirmText={deleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </>
  );
}