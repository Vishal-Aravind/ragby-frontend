import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req, { params }) {
  const { projectId } = await params;
  return proxyToBackend(
    `/public/appointments/${encodeURIComponent(projectId)}/services`,
    { req }
  );
}
