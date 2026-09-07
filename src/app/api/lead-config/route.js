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

    // The backend status was discarded here, so a 403 from the permission
    // check came back to the browser as 200 and the UI cheerfully reported
    // "Lead capture settings saved" on a rejected save.
    if (!res.ok) {
      const text = await res.text()
      console.error('Lead config save rejected:', res.status, text)
      const error =
        res.status === 403
          ? "You don't have permission to change these settings."
          : 'Could not save lead capture settings.'
      return NextResponse.json({ error }, { status: res.status })
    }

    return NextResponse.json(await res.json())
  } catch (err) {
    console.error('Lead config save error:', err)
    return NextResponse.json(
      { error: 'Could not reach the server. Please try again.' },
      { status: 502 }
    )
  }
}