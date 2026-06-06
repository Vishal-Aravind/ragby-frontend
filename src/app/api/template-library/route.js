// src/app/api/template-library/route.js
import { NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://ragby-backend.onrender.com";

export async function GET() {
  const res = await fetch(`${BACKEND}/template-library`);
  if (!res.ok) return NextResponse.json([]);
  return NextResponse.json(await res.json());
}