"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function NewProjectPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [intent, setIntent] = useState("general");
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


    const { data, error } = await supabase
      .from("projects")
      .insert({
        name,
        intent,
        user_id: user.id,
        logo_url,
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/dashboard/${data.id}`);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-xl p-6">
        <h1 className="text-2xl font-semibold mb-6">Create new project</h1>

        <div className="space-y-4">
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

          <Select value={intent} onValueChange={setIntent}>
            <SelectTrigger>
              <SelectValue placeholder="Select project intent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="sales">Sales / Marketing</SelectItem>
              <SelectItem value="sop">SOP / Internal docs</SelectItem>
              <SelectItem value="support">Support / Helpdesk</SelectItem>
            </SelectContent>
          </Select>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button onClick={createProject} disabled={loading} className="w-full">
            {loading ? "Creating..." : "Create project"}
          </Button>
        </div>
      </main>
    </div>
  );
}