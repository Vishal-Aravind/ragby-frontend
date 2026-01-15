"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createProject = async () => {
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name,
        intent,
        user_id: user.id,
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
        <h1 className="text-2xl font-semibold mb-6">
          Create new project
        </h1>

        <div className="space-y-4">
          <Input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Select value={intent} onValueChange={setIntent}>
            <SelectTrigger>
              <SelectValue placeholder="Select project intent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">
                General
              </SelectItem>
              <SelectItem value="sales">
                Sales / Marketing
              </SelectItem>
              <SelectItem value="sop">
                SOP / Internal docs
              </SelectItem>
              <SelectItem value="support">
                Support / Helpdesk
              </SelectItem>
            </SelectContent>
          </Select>

          {error && (
            <p className="text-sm text-red-500">
              {error}
            </p>
          )}

          <Button
            onClick={createProject}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Creating..." : "Create project"}
          </Button>
        </div>
      </main>
    </div>
  );
}
