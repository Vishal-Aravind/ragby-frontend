import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { projectId, message, history } = await req.json();

    // Ensure environment variable exists
    if (!process.env.BACKEND_BASE_URL) {
      console.error("Missing BACKEND_BASE_URL in .env");
      return NextResponse.json({ error: "Backend configuration missing" }, { status: 500 });
    }

    const res = await fetch(`${process.env.BACKEND_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, message, history }),
    });

    // 1. Check if the response is actually OK (status 200-299)
    if (!res.ok) {
      const errorText = await res.text(); // Get the "Internal Server Error" text
      console.error("FastAPI Backend Error:", errorText);
      return NextResponse.json(
        { error: "RAG Backend failed", details: errorText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error("Ask Route Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}