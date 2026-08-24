import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { hasProjectTabAccess } from "@/lib/project-access";
import ApiKeysClient from "./ApiKeysClient";

export default async function ApiKeysPage({ params }) {
  const { projectId } = await params;
  const { project } = await getProjectForRequest(projectId);
  if (!project) redirect("/dashboard");
  if (!hasProjectTabAccess(project, "api")) redirect(`/dashboard/${projectId}`);

  const headerList = await headers();
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/api-keys/${projectId}`, {
    cache: "no-store",
    headers: { cookie: headerList.get("cookie") || "" },
  });
  const initialApiKey = res.ok ? await res.json() : null;

  return <ApiKeysClient projectId={projectId} initialApiKey={initialApiKey} />;
}
