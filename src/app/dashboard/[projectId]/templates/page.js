import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { hasProjectTabAccess } from "@/lib/project-access";
import TemplateLibraryClient from "./TemplateLibraryClient";

export default async function TemplatesPage({ params }) {
  const { projectId } = await params;
  const { project } = await getProjectForRequest(projectId);
  if (!project) redirect("/dashboard");
  if (!hasProjectTabAccess(project, "templates")) redirect(`/dashboard/${projectId}`);

  // The API route needs the signed-in user's cookie to reach the backend.
  const headerList = await headers();
  let initialTemplates = [];
  let initialError = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/template-library`, {
      cache: "no-store",
      headers: { cookie: headerList.get("cookie") || "" },
    });
    if (res.ok) initialTemplates = await res.json();
    else initialError = "Could not load the template library. Please refresh.";
  } catch {
    initialError = "Could not reach the server. Please refresh.";
  }

  return <TemplateLibraryClient projectId={projectId} initialTemplates={initialTemplates} initialError={initialError} />;
}
