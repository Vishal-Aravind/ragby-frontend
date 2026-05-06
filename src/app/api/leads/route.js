import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-api'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL

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

  try {
    const res = await fetch(`${BACKEND}/leads?project_id=${projectId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Backend leads error:', text)
      return NextResponse.json([], { status: 200 })
    }

    const data = await res.json()
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch (err) {
    console.error('Leads fetch error:', err)
    return NextResponse.json([], { status: 200 })
  }
}