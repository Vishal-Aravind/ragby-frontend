import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { hasProjectTabAccess } from "@/lib/project-access";
import LeadsClient from "./LeadsClient";

export default async function LeadsPage({ params }) {
  const { projectId } = await params;
  const { project } = await getProjectForRequest(projectId);
  if (!project) redirect("/dashboard");
  if (!hasProjectTabAccess(project, "leads")) redirect(`/dashboard/${projectId}`);

  const headerList = await headers();

  // The failure here used to collapse into an empty array, which the client
  // then rendered as "No leads yet. They appear here when someone messages
  // your WhatsApp..." — a backend outage looked exactly like a new account.
  let initialLeads = [];
  let initialTotal = 0;
  let initialError = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/leads?projectId=${projectId}`, {
      cache: "no-store",
      headers: { cookie: headerList.get("cookie") || "" },
    });
    if (res.ok) {
      const data = await res.json();
      initialLeads = data.leads || [];
      initialTotal = data.total || 0;
    } else {
      const data = await res.json().catch(() => ({}));
      initialError = data.error || "Could not load leads.";
    }
  } catch {
    initialError = "Could not reach the server. Please try again.";
  }

  return (
    <LeadsClient
      projectId={projectId}
      initialLeads={initialLeads}
      initialTotal={initialTotal}
      initialError={initialError}
    />
  );
}
