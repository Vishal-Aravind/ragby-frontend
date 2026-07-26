"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X } from "lucide-react";

const DOMAINS = [
  "Healthcare",
  "Insurance",
  "Sales",
  "Finance",
  "Legal",
  "Education",
  "Other",
];

// Shared form — used both by this standalone page and by the "+ New project"
// popup on the dashboard (src/app/dashboard/page.js), so there's one copy
// of the create-project logic instead of two.
export function NewProjectForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleRemoveLogo() {
    setLogoFile(null);
    setLogoPreview(null);
  }

  const createProject = async () => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    // Upload logo if provided
    let logo_url = null;
    if (logoFile) {
      const ext = logoFile.name.split(".").pop();
      const path = `logos/${user.id}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(path, logoFile, { upsert: true });

      if (uploadError) {
        setError("Logo upload failed: " + uploadError.message);
        setLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(path);

      logo_url = urlData.publicUrl;
    }

    // Resolve final domain — same logic as SettingsTab
    const finalDomain = domain === "Other"
      ? customDomain.trim()
      : domain;

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, domain: finalDomain || null, logo_url }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to create project");
      setLoading(false);
      return;
    }

    router.push(`/dashboard/${data.id}`);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Project name */}
      <Input
        placeholder="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {/* Logo upload */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Project logo <span className="text-xs">(optional)</span>
        </label>

        {logoPreview ? (
          <div className="flex items-center gap-3 border rounded-lg p-3">
            <img
              src={logoPreview}
              alt="Logo preview"
              className="h-10 w-10 object-contain rounded"
            />
            <span className="text-sm truncate flex-1">{logoFile?.name}</span>
            <button
              onClick={handleRemoveLogo}
              className="text-muted-foreground hover:text-red-500"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <Button asChild variant="outline" className="w-full">
            <label className="cursor-pointer flex items-center gap-2">
              <Upload size={16} />
              Upload logo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
            </label>
          </Button>
        )}
      </div>

      {/* Domain — identical list to SettingsTab */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Business domain{" "}
          <span className="text-xs">(optional — helps AI give better answers)</span>
        </label>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="border p-2 rounded-lg w-full text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">Select domain</option>
          {DOMAINS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {domain === "Other" && (
          <input
            type="text"
            placeholder="Enter your domain (e.g. Real Estate)"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            className="border p-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button
        onClick={createProject}
        disabled={loading || !name.trim()}
        className="w-full"
      >
        {loading ? "Creating..." : "Create project"}
      </Button>
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-xl p-6">
        <h1 className="text-2xl font-semibold mb-6">Create new project</h1>
        <NewProjectForm />
      </main>
    </div>
  );
}
