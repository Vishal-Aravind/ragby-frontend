import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { hasProjectTabAccess } from "@/lib/project-access";
import ConversationsTab from "./ConversationsTab";

export default async function ConversationsPage({ params }) {
  const { projectId } = await params;
  const { project } = await getProjectForRequest(projectId);
  if (!project) redirect("/dashboard");
  if (!hasProjectTabAccess(project, "conversations")) redirect(`/dashboard/${projectId}`);
  return <ConversationsTab projectId={projectId} />;
}
