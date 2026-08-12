import { NextResponse } from "next/server";
const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
export async function GET(req, { params }) {
  const { projectId, appointmentId } = await params;
  const res = await fetch(`${BACKEND}/public/appointments/${projectId}/reschedule/${appointmentId}`);
  const text = await res.text();
  try { return NextResponse.json(JSON.parse(text), { status: res.status }); }
  catch { return NextResponse.json({ error: text }, { status: res.status }); }
}
