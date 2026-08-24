import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { hasProjectTabAccess } from "@/lib/project-access";
import TemplateLibraryClient from "./TemplateLibraryClient";

export default async function TemplatesPage({ params }) {
  const { projectId } = await params;
  const { project } = await getProjectForRequest(projectId);
  if (!project) redirect("/dashboard");
  if (!hasProjectTabAccess(project, "templates")) redirect(`/dashboard/${projectId}`);

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/template-library`, {
    cache: "no-store",
  });
  const initialTemplates = res.ok ? await res.json() : [];

  return <TemplateLibraryClient projectId={projectId} initialTemplates={initialTemplates} />;
}
