import { NextResponse } from "next/server";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;
export async function GET(req, { params }) {
  const { projectId } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const res = await fetch(`${BACKEND}/public/appointments/${projectId}/slots?date=${date}`);
  return NextResponse.json(await res.json());
}
