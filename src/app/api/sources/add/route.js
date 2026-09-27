
// ─────────────────────────────────────────────────────────
// app/api/sources/add/route.js — POST: add a source
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-api";
import { proxyToBackend, LONG_SYNC_TIMEOUT_MS } from "@/lib/backend-proxy";

// Indexing a large sheet/file (thousands of rows, embedded in batches)
// takes well over 30s. The proxy used to give up at 30s and show
// "couldn't reach the server" while the backend carried on and finished,
// so the source appeared after a refresh and a retry could add it twice.
export const maxDuration = 300;

export async function POST(req) {
  const { supabase } = getSupabase(req);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Was a hand-rolled fetch with no try/catch and no JSON parsing of the
  // error body — a sleeping/unreachable backend threw inside this route
  // (generic non-JSON 500, no diagnostic value), and even a clean backend
  // error was forwarded as a raw JSON string instead of the parsed message.
  return proxyToBackend("/sources/add", { token: session.access_token, method: "POST", body, timeoutMs: LONG_SYNC_TIMEOUT_MS });
}
 