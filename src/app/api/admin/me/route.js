import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { requireStaff } from "@/lib/admin-auth";

// UI-only signal for the Navbar's "Admin panel" link visibility — not a
// security boundary itself. Every /api/admin/** route independently calls
// requireStaff() as the real gate, same as every other authenticated route
// in this codebase never trusts frontend-side checks alone.
export async function GET(req) {
  const { supabase } = getSupabase(req);
  const staff = await requireStaff(supabase);
  return NextResponse.json({ isStaff: !!staff });
}
