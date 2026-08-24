import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { hasProjectTabAccess } from "@/lib/project-access";
import CampaignsTab from "./CampaignsTab";

export default async function CampaignsPage({ params }) {
  const { projectId } = await params;
  const { project } = await getProjectForRequest(projectId);
  if (!project) redirect("/dashboard");
  if (!hasProjectTabAccess(project, "campaigns")) redirect(`/dashboard/${projectId}`);
  return <CampaignsTab project={project} />;
}
