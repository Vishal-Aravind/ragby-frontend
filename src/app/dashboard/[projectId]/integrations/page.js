import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { hasProjectTabAccess } from "@/lib/project-access";
import IntegrationsTab from "./IntegrationsTab";

export default async function IntegrationsPage({ params }) {
  const { projectId } = await params;
  const { project } = await getProjectForRequest(projectId);
  if (!project) redirect("/dashboard");
  if (!hasProjectTabAccess(project, "integrations")) redirect(`/dashboard/${projectId}`);
  return <IntegrationsTab projectId={projectId} />;
}
