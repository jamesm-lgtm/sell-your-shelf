import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  const { username, sessionId } = await req.json()

  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 })

  const country = req.headers.get('x-vercel-ip-country') || null
  const city = req.headers.get('x-vercel-ip-city') || null
  const userAgent = req.headers.get('user-agent') || null
  const referrer = req.headers.get('referer') || null

  await supabase.from('shelf_visits').insert({
    username,
    session_id: sessionId || null,
    country,
    city,
    user_agent: userAgent,
    referrer,
    platform: 'web',
  })

  return NextResponse.json({ ok: true })
}
