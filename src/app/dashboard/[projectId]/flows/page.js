import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { hasProjectTabAccess } from "@/lib/project-access";
import FlowsTab from "./FlowsTab";

export default async function FlowsPage({ params }) {
  const { projectId } = await params;
  const { project } = await getProjectForRequest(projectId);
  if (!project) redirect("/dashboard");
  if (!hasProjectTabAccess(project, "flows")) redirect(`/dashboard/${projectId}`);
  return <FlowsTab projectId={projectId} />;
}
