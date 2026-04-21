import { NextRequest, NextResponse } from 'next/server'

// Proxy: forwards book-analysis requests from the mobile app to the
// Supabase edge function, then reshapes the response so the shipped
// app keeps working.
//
// - Shipped app expects `{ books: [{ title, author, confidence }] }`.
// - Supabase analyze-books returns `{ high_confidence, needs_confirmation }`.
//   We flatten those two arrays into `books`, tagging confidence accordingly,
//   so the app's existing save-scan logic doesn't change.
//
// Kept here because shipped app builds hardcode this Vercel URL
// (sell-your-shelf-app.vercel.app/api/analyze-books) and we can't
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

  const upstream = await fetch(
    `${supabaseUrl}/functions/v1/analyze-books`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body,
    },
  )

  const raw = await upstream.json().catch(() => ({
    error: 'Upstream returned non-JSON',
  }))

  if (!upstream.ok) {
    return NextResponse.json(raw, { status: upstream.status })
  }

  // Flatten new shape -> old shape expected by shipped app builds.
  const high = Array.isArray(raw.high_confidence) ? raw.high_confidence : []
  const medium = Array.isArray(raw.needs_confirmation) ? raw.needs_confirmation : []

  const books = [
    ...high.map((b: Record<string, unknown>) => ({ ...b, confidence: 'high' })),
    ...medium.map((b: Record<string, unknown>) => ({ ...b, confidence: 'medium' })),
  ]

  return NextResponse.json({ books }, { status: 200 })
}

export const maxDuration = 300
