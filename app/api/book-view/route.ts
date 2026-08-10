import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isBotUserAgent } from '@/app/lib/botDetect'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// Mirrors /api/listing-view. No test-account filter here: book pages
// aggregate listings from many sellers, so there is no single owner to
// screen out.
export async function POST(req: NextRequest) {
  const {
    bookId,
    slug,
    sessionId,
    referrer,
    utm_source,
    utm_medium,
    utm_campaign,
  } = await req.json()

  if (!bookId) return NextResponse.json({ error: 'bookId required' }, { status: 400 })

  const country = req.headers.get('x-vercel-ip-country') || null
  const city = req.headers.get('x-vercel-ip-city') || null
  const userAgent = req.headers.get('user-agent') || null

  const { error } = await supabase.from('book_views').insert({
    book_id: bookId,
    slug: slug || null,
    session_id: sessionId || null,
    country,
    city,
    user_agent: userAgent,
    referrer,
    utm_source: utm_source || null,
    utm_medium: utm_medium || null,
    utm_campaign: utm_campaign || null,
    platform: 'web',
    is_bot: isBotUserAgent(userAgent),
    // user_id stays null on web until cookie-based auth lands.
  })

  if (error) {
    console.error('book_views insert failed', { bookId, error })
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
