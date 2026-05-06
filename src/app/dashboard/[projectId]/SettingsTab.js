"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const DOMAINS = [
  "Healthcare",
  "Insurance",
  "Sales",
  "Finance",
  "Legal",
  "Education",
  "Other",
];

export default function SettingsTab({ project, onUpdate }) {
  const [domain, setDomain] = useState(project.domain || "");
  const [customDomain, setCustomDomain] = useState("");

  const handleSave = async () => {
    const finalDomain = domain === "Other" ? customDomain.trim() : domain;
    await onUpdate({ domain: finalDomain });
  };

  return (
    <div className="space-y-4 max-w-md">
      <select
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        className="border p-2 rounded w-full"
      >
        <option value="">Select domain</option>
        {DOMAINS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {domain === "Other" && (
        <input
          type="text"
          placeholder="Custom domain"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          className="border p-2 rounded w-full"
        />
      )}

      <Button onClick={handleSave}>Save</Button>
    </div>
  );
}