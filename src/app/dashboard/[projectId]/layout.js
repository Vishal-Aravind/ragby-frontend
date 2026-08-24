import Navbar from "@/components/Navbar";
import DashboardShell from "./DashboardShell";
import { getProjectForRequest } from "@/lib/get-project-for-request";

export default async function ProjectLayout({ children, params }) {
  const { projectId } = await params;
  const { project, status } = await getProjectForRequest(projectId);

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="p-6">Project not found (Error: {status})</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="p-6">
        <DashboardShell project={project}>{children}</DashboardShell>
      </div>
    </div>
  );
}
