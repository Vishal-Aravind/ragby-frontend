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
  // A failed fetch used to render exactly like "no key exists", so a 403 or
  // an unreachable backend looked like an empty state the user could act on.
  let initialApiKey = null;
  let initialError = null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/api-keys/${projectId}`, {
      cache: "no-store",
      headers: { cookie: headerList.get("cookie") || "" },
    });
    if (res.ok) {
      initialApiKey = await res.json();
    } else {
      const body = await res.json().catch(() => ({}));
      initialError = body.detail || body.error || "Could not load your API key.";
    }
  } catch {
    initialError = "Could not reach the server.";
  }

  return <ApiKeysClient projectId={projectId} initialApiKey={initialApiKey} initialError={initialError} />;
}
