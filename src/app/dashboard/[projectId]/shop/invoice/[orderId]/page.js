import { redirect } from "next/navigation";
import { getProjectForRequest } from "@/lib/get-project-for-request";
import { hasProjectTabAccess } from "@/lib/project-access";
import DashboardInvoice from "./DashboardInvoice";

export default async function DashboardInvoicePage({ params }) {
  const { projectId, orderId } = await params;
  const { project } = await getProjectForRequest(projectId);
  if (!project) redirect("/dashboard");
  if (!hasProjectTabAccess(project, "shop")) redirect(`/dashboard/${projectId}`);
  return <DashboardInvoice projectId={projectId} orderId={orderId} />;
}
