import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req, { params }) {
  const { projectId, appointmentId } = await params;
  return proxyToBackend(
    `/public/appointments/${encodeURIComponent(projectId)}/reschedule/${encodeURIComponent(appointmentId)}`,
    { req }
  );
}
