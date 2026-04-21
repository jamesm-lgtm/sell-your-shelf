import { NextRequest, NextResponse } from 'next/server'

// Proxy: forwards OCR requests from the mobile app to the Supabase
// edge function. Kept here because shipped app builds hardcode this
// Vercel URL (sell-your-shelf-app.vercel.app/api/ocr) and we can't
// redeploy those without an App Store submission.
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Supabase env vars missing on Vercel' },
      { status: 500 },
    )
  }

  const body = await req.text()

  const upstream = await fetch(`${supabaseUrl}/functions/v1/ocr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body,
  })

  const data = await upstream.json().catch(() => ({
    error: 'Upstream returned non-JSON',
  }))

  return NextResponse.json(data, { status: upstream.status })
}

// Keep lambda warm for up to 5 min so OCR latency stays low.
export const maxDuration = 300
