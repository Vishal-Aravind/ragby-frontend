// src\app\dashboard\[projectId]\DocumentsTab.js

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Trash2 } from "lucide-react";

export default function DocumentsTab({
  files,
  onSelectFiles,
  onUpload,
  uploading,
  onDeleteFile,
}) {
  const handleChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length) onSelectFiles(selected);
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Documents</h2>

          <div className="flex gap-2">
            <Button asChild variant="outline">
              <label className="cursor-pointer flex items-center gap-2">
                <Upload size={16} />
                Select files
                <Input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.pptx,.txt"
                  className="hidden"
                  onChange={handleChange}
                />
              </label>
            </Button>

            <Button
              onClick={onUpload}
              disabled={uploading || files.every(f => f.status !== "pending")}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>

        {files.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No documents uploaded yet.
          </p>
        )}

        <div className="space-y-2">
          {files.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between border rounded px-3 py-2"
            >
              <span className="truncate">{file.name}</span>

              <div className="flex items-center gap-2">
                <span className="text-xs border rounded px-2 py-0.5">
                  {file.status.toUpperCase()}
                </span>

                <button
                  onClick={() => onDeleteFile(file)}
                  className="text-muted-foreground hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
