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
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/leads?projectId=${projectId}`, {
    cache: "no-store",
    headers: { cookie: headerList.get("cookie") || "" },
  });
  const initialLeads = res.ok ? await res.json() : [];

  return <LeadsClient projectId={projectId} initialLeads={initialLeads} />;
}
