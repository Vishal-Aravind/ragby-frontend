import { NextResponse } from "next/server";

/**
 * A 500 that says nothing useful to the caller, with the real cause logged.
 *
 * Twenty-two routes returned `error.message` from a Supabase error straight
 * to the client. That string is PostgREST's own text: it names tables,
 * columns, constraints and sometimes the failing value. Every one of those
 * routes is authenticated, so this was never anonymous exposure — but it
 * hands any signed-up account a free map of the schema, which is exactly
 * what an attacker wants before trying anything else.
 *
 * `context` is for the log only and never reaches the response.
 */
export function dbError(context, error, message = "Something went wrong. Please try again.") {
  console.error(`${context} failed:`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}
