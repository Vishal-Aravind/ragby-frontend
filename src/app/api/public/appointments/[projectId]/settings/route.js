import { NextResponse } from "next/server";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;
export async function GET(req, { params }) {
  const { projectId } = await params;
  const res = await fetch(`${BACKEND}/public/appointments/${projectId}/settings`);
  if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: res.status });
  return NextResponse.json(await res.json());
}
