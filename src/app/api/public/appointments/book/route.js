import { NextResponse } from "next/server";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;
export async function POST(req) {
  const body = await req.json();
  const res = await fetch(`${BACKEND}/public/appointments/book`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  try { return NextResponse.json(JSON.parse(text), { status: res.status }); }
  catch { return NextResponse.json({ error: text }, { status: res.status }); }
}
