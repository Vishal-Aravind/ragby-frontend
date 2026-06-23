import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
function getSupabase(req) {
  const response = NextResponse.next();
  return { supabase: createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { get: (n) => req.cookies.get(n)?.value, set: (n, v, o) => response.cookies.set({ name: n, value: v, ...o }), remove: (n, o) => response.cookies.set({ name: n, value: "", ...o }) } }) };
}
export async function PUT(req, { params }) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { appointmentId } = await params;
  const body = await req.json();
  const res = await fetch(`${BACKEND}/appointments/${appointmentId}`, { method: "PUT", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  try { return NextResponse.json(JSON.parse(text), { status: res.status }); }
  catch { return NextResponse.json({ error: text }, { status: res.status }); }
}
