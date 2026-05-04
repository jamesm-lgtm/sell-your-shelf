import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  const { listingId, sessionId, referrer } = await req.json()

  if (!listingId) return NextResponse.json({ error: 'listingId required' }, { status: 400 })

  const country = req.headers.get('x-vercel-ip-country') || null
  const city = req.headers.get('x-vercel-ip-city') || null
  const userAgent = req.headers.get('user-agent') || null

  const { error } = await supabase.from('listing_views').insert({
    listing_id: listingId,
    session_id: sessionId || null,
    country,
    city,
    user_agent: userAgent,
    referrer,
    platform: 'web',
  })

  if (error) {
    console.error('listing_views insert failed', { listingId, error })
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
