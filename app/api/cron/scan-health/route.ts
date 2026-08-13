import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Daily health check for the mobile app's shelf-scanning pipeline
// (app → /api/ocr → Google Vision → /api/analyze-books → Claude).
//
// Why this exists: on 2026-06-15 the Anthropic model hardcoded in the
// analyze-books edge function (claude-sonnet-4-20250514) reached its
// retirement date and started returning 404. Shelf scanning produced zero
// results for ~2 months and nobody noticed, because the app degrades to
// "no books found" rather than surfacing an error, and users silently fell
// back to barcode scanning. Roughly 1,000-1,800 listings were lost.
//
// Two independent checks, because each catches what the other misses:
//
//   1. SYNTHETIC PROBE (primary). Calls analyze-books with fixed OCR text and
//      asserts real books come back. Catches a broken pipeline within a day
//      regardless of how much user traffic there is — this is the check that
//      would have caught the model retirement on day one.
//
//   2. SCAN VOLUME (secondary). Zero scan_history rows in ZERO_SCAN_ALERT_DAYS
//      means users aren't completing scans even if the probe passes. The
//      threshold is deliberately loose: the longest natural zero-scan gap in
//      the table's history was 10 days (Jan 2026, low traffic), so anything at
//      or below that would false-fire.
//
// Alerting: an unhealthy result returns HTTP 500 so Vercel's cron failure
// notifications fire. There is no email dependency to configure or rotate.
// (Vercel Dashboard → Project → Settings → Notifications → Cron Job Failures.)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

const ZERO_SCAN_ALERT_DAYS = 14

// Three unambiguous, well-known titles. Kept deliberately boring: the probe is
// asserting that the pipeline runs and returns structured books, not grading
// the model's recall on hard input.
const PROBE_OCR_TEXT = [
  'THE THURSDAY MURDER CLUB RICHARD OSMAN',
  'NORMAL PEOPLE SALLY ROONEY',
  'SAPIENS YUVAL NOAH HARARI',
].join('\n')

const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY!)

type Check = { name: string; ok: boolean; detail: string }

async function probeAnalyzeBooks(): Promise<Check> {
  const name = 'analyze_books_probe'
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        ocrFrames: [0, 1, 2].map((i) => ({ frameIndex: i, timestamp: i, text: PROBE_OCR_TEXT })),
      }),
      signal: AbortSignal.timeout(120_000),
    })

    const raw = await res.json().catch(() => null)

    if (!res.ok) {
      // The 2026-06-15 failure looked exactly like this: 500 wrapping
      // "Claude API error: 404".
      return { name, ok: false, detail: `HTTP ${res.status}: ${JSON.stringify(raw)?.slice(0, 300)}` }
    }

    // analyze-books returns { high_confidence: [], needs_confirmation: [] }.
    // An empty result on this input means the pipeline runs but is not
    // identifying anything — still broken, just more quietly.
    const found =
      (Array.isArray(raw?.high_confidence) ? raw.high_confidence.length : 0) +
      (Array.isArray(raw?.needs_confirmation) ? raw.needs_confirmation.length : 0)

    if (found === 0) {
      return { name, ok: false, detail: `200 but identified 0 books: ${JSON.stringify(raw)?.slice(0, 300)}` }
    }

    return { name, ok: true, detail: `identified ${found} books` }
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : 'unknown error' }
  }
}

async function checkScanVolume(): Promise<Check> {
  const name = 'scan_volume'
  const since = new Date(Date.now() - ZERO_SCAN_ALERT_DAYS * 86_400_000).toISOString()

  const { count, error } = await supabase
    .from('scan_history')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)

  if (error) return { name, ok: false, detail: `query failed: ${error.message}` }

  const n = count ?? 0
  return {
    name,
    ok: n > 0,
    detail: `${n} scans in the last ${ZERO_SCAN_ALERT_DAYS} days`,
  }
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const checks = await Promise.all([probeAnalyzeBooks(), checkScanVolume()])
  const failed = checks.filter((c) => !c.ok)

  if (failed.length > 0) {
    // Logged as an error so it is greppable in Vercel logs, and returned as a
    // 500 so the cron itself is marked failed and notifications fire.
    console.error('🚨 scan-health FAILED:', JSON.stringify(failed))
    return NextResponse.json({ ok: false, checks }, { status: 500 })
  }

  return NextResponse.json({ ok: true, checks })
}

// The probe waits on a Claude call; give it room.
export const maxDuration = 300
