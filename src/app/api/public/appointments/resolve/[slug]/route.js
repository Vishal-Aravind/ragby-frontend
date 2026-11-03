import { proxyToBackend } from "@/lib/backend-proxy";

// /book/<name> -> the project id behind that link name
export async function GET(req, { params }) {
  const { slug } = await params;
  return proxyToBackend(`/public/appointments/resolve/${encodeURIComponent(slug)}`, { req });
}
