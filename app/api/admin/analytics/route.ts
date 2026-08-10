import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// All aggregation happens in the admin_search_funnel_dashboard() Postgres
// function — one round-trip, no PostgREST row caps. Unlike the other admin
// routes this one requires the admin password on every call: funnel/GMV data
// shouldn't be readable by anyone who guesses the URL.
export async function POST(req: NextRequest) {
  const { password, days } = await req.json()

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const windowDays = [7, 30, 90].includes(days) ? days : 30

  const { data, error } = await supabase.rpc('admin_search_funnel_dashboard', {
    p_days: windowDays,
  })

  if (error) {
    console.error('admin_search_funnel_dashboard failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
