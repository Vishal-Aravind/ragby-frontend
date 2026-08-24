import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { hasProjectTabAccess } from "@/lib/project-access";
import DocumentsPageClient from "./DocumentsPageClient";

export default async function DocumentsPage({ params }) {
  const { projectId } = await params;
  const { project } = await getProjectForRequest(projectId);
  if (!project) redirect("/dashboard");
  if (!hasProjectTabAccess(project, "documents")) redirect(`/dashboard/${projectId}`);
  return <DocumentsPageClient projectId={projectId} />;
}
