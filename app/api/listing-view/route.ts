import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getTestAccountUserIds } from '@/app/lib/testAccounts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  const {
    listingId,
    sessionId,
    referrer,
    utm_source,
    utm_medium,
    utm_campaign,
  } = await req.json()

  if (!listingId) return NextResponse.json({ error: 'listingId required' }, { status: 400 })

  const country = req.headers.get('x-vercel-ip-country') || null
  const city = req.headers.get('x-vercel-ip-city') || null
  const userAgent = req.headers.get('user-agent') || null

  // Skip inserts for listings owned by test accounts.
  const { data: listing } = await supabase
    .from('listings')
    .select('user_id')
    .eq('id', listingId)
    .maybeSingle()

  if (listing?.user_id) {
    const testIds = await getTestAccountUserIds(supabase)
    if (testIds.has(listing.user_id)) {
      return NextResponse.json({ ok: true, skipped: 'test_account' })
    }
  }

  const { error } = await supabase.from('listing_views').insert({
    listing_id: listingId,
    session_id: sessionId || null,
    country,
    city,
    user_agent: userAgent,
    referrer,
    utm_source: utm_source || null,
    utm_medium: utm_medium || null,
    utm_campaign: utm_campaign || null,
    platform: 'web',
    // user_id stays null on web until cookie-based auth lands.
  })

  if (error) {
    console.error('listing_views insert failed', { listingId, error })
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
