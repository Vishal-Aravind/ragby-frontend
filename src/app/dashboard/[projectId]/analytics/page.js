import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { hasProjectTabAccess } from "@/lib/project-access";
import AnalyticsClient from "./AnalyticsClient";

export default async function AnalyticsPage({ params }) {
  const { projectId } = await params;
  const { project } = await getProjectForRequest(projectId);
  if (!project) redirect("/dashboard");
  if (!hasProjectTabAccess(project, "analytics")) redirect(`/dashboard/${projectId}`);

  const headerList = await headers();
  const cookie = headerList.get("cookie") || "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  const [analyticsRes, gapsRes] = await Promise.all([
    fetch(`${baseUrl}/api/analytics?project_id=${projectId}`, { cache: "no-store", headers: { cookie } }),
    fetch(`${baseUrl}/api/analytics/unanswered-questions?project_id=${projectId}`, { cache: "no-store", headers: { cookie } }),
  ]);

  const analyticsData = analyticsRes.ok ? await analyticsRes.json() : {};
  const gapsData = gapsRes.ok ? await gapsRes.json() : {};

  return (
    <AnalyticsClient
      projectId={projectId}
      initialStats={analyticsData.stats}
      initialChartData={analyticsData.chart}
      initialOutcomes={analyticsData.outcomes || null}
      initialGaps={gapsData.groups || []}
    />
  );
}
