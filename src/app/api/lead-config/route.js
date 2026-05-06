import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-api'

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL

export async function PUT(req) {
  const { supabase } = getSupabase(req)
  const body = await req.json()

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const res = await fetch(`${BACKEND}/lead-config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(body)
    })

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Lead config save error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}