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
// Alerting: an unhealthy result emails ALERT_EMAIL_TO via Resend, and also
// returns HTTP 500 so the failure is visible on the Cron Jobs page.
//
// The email is the part that matters. Vercel does NOT notify on cron failure
// unless you're on Enterprise/Pro with the Observability Plus add-on — its own
// docs say "Vercel will not retry an invocation if a cron job fails" and point
// at manually clicking View Log. A 500 nobody is watching is exactly the
// failure mode that let the June outage run for two months.

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

// Returns a human-readable note about what happened, so the route's own
// response says whether the alert actually went anywhere. A misconfigured
// alerter that fails quietly is the bug we're fixing, not an acceptable
// degradation — so a missing key is reported, never swallowed.
async function sendAlertEmail(failed: Check[]): Promise<string> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ALERT_EMAIL_TO

  if (!apiKey || !to) {
    const missing = [!apiKey && 'RESEND_API_KEY', !to && 'ALERT_EMAIL_TO'].filter(Boolean).join(', ')
    console.error(`🚨 scan-health is unhealthy but cannot alert: ${missing} not set on this project`)
    return `NOT SENT — ${missing} not configured`
  }

  const lines = failed.map((c) => `- ${c.name}: ${c.detail}`).join('\n')

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: 'Sell Your Shelf <noreply@sellyourshelf.com>',
        to: [to],
        subject: '🚨 Shelf scanning looks broken',
        text:
          `The daily scan-health check failed:\n\n${lines}\n\n` +
          `What to check, in order:\n` +
          `1. POST ${SUPABASE_URL}/functions/v1/analyze-books with a few ocrFrames — ` +
          `a "Claude API error: 404" means the hardcoded model has been retired again.\n` +
          `2. Supabase → Edge Functions → analyze-books / ocr logs.\n` +
          `3. Google Vision key/billing (ocr logs the error body and reports ocr_failed_frames).\n\n` +
          `Context: this exact check exists because shelf scanning died silently on ` +
          `2026-06-15 when claude-sonnet-4-20250514 hit its retirement date, and stayed ` +
          `broken for ~2 months (est. 1,000-1,800 lost listings). The app shows users ` +
          `"no books found" rather than an error, so there is no complaint signal.`,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable>')
      console.error(`🚨 alert email failed: HTTP ${res.status} ${body.slice(0, 300)}`)
      return `NOT SENT — Resend returned ${res.status}`
    }

    return `sent to ${to}`
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown error'
    console.error(`🚨 alert email threw: ${detail}`)
    return `NOT SENT — ${detail}`
  }
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const checks = await Promise.all([probeAnalyzeBooks(), checkScanVolume()])
  const failed = checks.filter((c) => !c.ok)

  if (failed.length > 0) {
    console.error('🚨 scan-health FAILED:', JSON.stringify(failed))
    const alert = await sendAlertEmail(failed)
    return NextResponse.json({ ok: false, checks, alert }, { status: 500 })
  }

  return NextResponse.json({ ok: true, checks })
}

// The probe waits on a Claude call; give it room.
export const maxDuration = 300
