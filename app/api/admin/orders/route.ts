import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// Order-tracking board across every channel. All the work happens in the
// admin_orders_board() Postgres function — one round-trip, no row caps.
// Password required on every call: this exposes buyer addresses and seller
// contact details.
export async function POST(req: NextRequest) {
  const { password, days } = await req.json()

  // Fail closed when ADMIN_PASSWORD is unset, or the comparison would be
  // against undefined and an empty password would authenticate.
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword || password !== adminPassword) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const windowDays = [30, 90, 365].includes(days) ? days : 90

  const { data, error } = await supabase.rpc('admin_orders_board', {
    p_days: windowDays,
  })

  if (error) {
    console.error('admin_orders_board failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
