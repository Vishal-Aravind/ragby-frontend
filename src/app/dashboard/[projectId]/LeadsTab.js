"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function LeadsTab({ project }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!project?.id) return;
    loadLeads();
  }, [project.id]);

  const loadLeads = async () => {
    setLoading(true);

    try {
      const res = await fetch(`/api/leads?projectId=${project.id}`);

      if (!res.ok) {
        console.error("Failed to load leads");
        setLeads([]);
        setLoading(false);
        return;
      }

      const data = await res.json();
      setLeads(data || []);
    } catch (err) {
      console.error("Error loading leads", err);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const res = await fetch("/api/leads/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      if (!res.ok) {
        console.error("Failed to update lead");
        return;
      }

      setLeads((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, status } : l
        )
      );
    } catch (err) {
      console.error("Error updating lead", err);
    }
  };

  const badgeStyle = (status) => {
    switch (status) {
      case "new":
        return "bg-yellow-100 text-yellow-800";
      case "contacted":
        return "bg-blue-100 text-blue-800";
      case "converted":
        return "bg-green-100 text-green-800";
      case "ignored":
        return "bg-gray-900 text-white";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading leads…
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="text-sm text-muted-foreground">
        No leads captured yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        Captured Leads
      </h2>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm text-center">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
              <th className="px-3 py-2">Captured</th>
            </tr>
          </thead>

          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-t">
                <td className="px-3 py-2 font-medium">
                  {lead.name || "—"}
                </td>

                <td className="px-3 py-2">
                  {lead.email || "—"}
                </td>

                <td className="px-3 py-2">
                  {lead.phone || "—"}
                </td>

                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${badgeStyle(
                      lead.status || "new"
                    )}`}
                  >
                    {lead.status || "new"}
                  </span>
                </td>

                <td className="px-3 py-2">
                  <div className="flex justify-center gap-2">
                    <Button
                      size="sm"
                      className="bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() =>
                        updateStatus(lead.id, "contacted")
                      }
                    >
                      Contacted
                    </Button>

                    <Button
                      size="sm"
                      className="bg-green-600 text-white hover:bg-green-700"
                      onClick={() =>
                        updateStatus(lead.id, "converted")
                      }
                    >
                      Converted
                    </Button>

                    <Button
                      size="sm"
                      className="bg-black text-white hover:bg-black/90"
                      onClick={() =>
                        updateStatus(lead.id, "ignored")
                      }
                    >
                      Ignore
                    </Button>
                  </div>
                </td>

                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(
                    lead.created_at
                  ).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
