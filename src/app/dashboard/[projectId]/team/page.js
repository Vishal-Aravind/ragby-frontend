import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { hasProjectTabAccess } from "@/lib/project-access";
import TeamClient from "./TeamClient";

export default async function TeamPage({ params }) {
  const { projectId } = await params;
  const { project } = await getProjectForRequest(projectId);
  if (!project) redirect("/dashboard");
  if (!hasProjectTabAccess(project, "team")) redirect(`/dashboard/${projectId}`);

  const headerList = await headers();
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/team?projectId=${projectId}`, {
    cache: "no-store",
    headers: { cookie: headerList.get("cookie") || "" },
  });
  const initialData = res.ok ? await res.json() : null;

  return <TeamClient projectId={projectId} initialData={initialData} />;
}
