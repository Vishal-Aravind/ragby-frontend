import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req, { params }) {
  // 1. Await params here!
  const { projectId } = await params; 

  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => req.cookies.getAll(), // Newer Supabase SSR prefers getAll
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Use the awaited projectId
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, created_at, intent")
    .eq("id", projectId) 
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    console.error("Supabase Error:", error); // Log this to see actual DB issues
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}