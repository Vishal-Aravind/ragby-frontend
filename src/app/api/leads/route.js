import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-api'

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_BASE_URL

export async function GET(req) {
  const { supabase } = getSupabase(req)
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 })
  }

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0)
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '200', 10) || 200))

  try {
    const res = await fetch(
      `${BACKEND}/leads?project_id=${encodeURIComponent(projectId)}&offset=${offset}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${session.access_token}` } }
    )

    if (!res.ok) {
      // Was returning [] with HTTP 200 here, so a 403 was indistinguishable
      // from "this project has no leads yet" — the caller's error branch
      // could never run and a permission problem looked like an empty state.
      const text = await res.text()
      console.error('Backend leads error:', res.status, text)
      const error =
        res.status === 403
          ? "You don't have access to this project's leads."
          : 'Could not load leads. Please try again.'
      return NextResponse.json({ error }, { status: res.status })
    }

    return NextResponse.json(await res.json())
  } catch (err) {
    console.error('Leads fetch error:', err)
    return NextResponse.json(
      { error: 'Could not reach the server. Please try again.' },
      { status: 502 }
    )
  }
}
