import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const serviceId = searchParams.get("service_id");

  // Both are required query params on the backend. Missing ones used to be
  // interpolated as the literal string "null", which reached the backend as
  // a real value and came back as a date-format error.
  if (!date || !serviceId) {
    return NextResponse.json(
      { detail: "A date and a service are required.", slots: [] },
      { status: 400 }
    );
  }

  const qs = new URLSearchParams({ date, service_id: serviceId });
  return proxyToBackend(
    `/public/appointments/${encodeURIComponent(projectId)}/slots?${qs}`,
    { req }
  );
}
