import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req, { params }) {
  const { projectId } = await params;
  // ?service=<id>: the page was opened from one service's own link (hidden
  // services are only returned for that id)
  const service = new URL(req.url).searchParams.get("service");
  const qs = service ? `?${new URLSearchParams({ service })}` : "";
  return proxyToBackend(
    `/public/appointments/${encodeURIComponent(projectId)}/services${qs}`,
    { req }
  );
}
