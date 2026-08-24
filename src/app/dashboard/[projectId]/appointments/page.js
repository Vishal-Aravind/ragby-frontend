import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { hasProjectTabAccess } from "@/lib/project-access";
import AppointmentsTab from "./AppointmentsTab";

export default async function AppointmentsPage({ params }) {
  const { projectId } = await params;
  const { project } = await getProjectForRequest(projectId);
  if (!project) redirect("/dashboard");
  if (!hasProjectTabAccess(project, "appointments")) redirect(`/dashboard/${projectId}`);
  return <AppointmentsTab project={project} />;
}
