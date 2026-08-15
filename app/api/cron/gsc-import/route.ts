import { createSign } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Daily Google Search Console import → gsc_daily.
// Runs on a Vercel cron (see vercel.json); Vercel authenticates cron
// invocations with `Authorization: Bearer ${CRON_SECRET}`.
//
// Re-imports a rolling window ending 2 days ago (GSC data lags ~48h and
// recent days get restated), upserting on (date, page, query).

const SITE = 'sc-domain:sellyourshelf.com'
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const WINDOW_DAYS = 5

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function b64url(o: object): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}

async function gscAccessToken(): Promise<string> {
  const clientEmail = process.env.GSC_CLIENT_EMAIL
  // Vercel env vars flatten newlines; the key is stored with literal \n.
  const privateKey = process.env.GSC_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!clientEmail || !privateKey) throw new Error('GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY not configured')

  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({
    iss: clientEmail,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  const assertion = `${unsigned}.${signer.sign(privateKey, 'base64url')}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const json = await res.json()
  if (!json.access_token) throw new Error(`GSC token failed: ${JSON.stringify(json)}`)
  return json.access_token
}

export async function GET(req: NextRequest) {
  // Fail closed when CRON_SECRET is unset — otherwise the comparison is against
  // the literal "Bearer undefined" and anyone sending that string gets in. This
  // route writes to gsc_daily, so the bypass is worse here than on scan-health.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const token = await gscAccessToken()

    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const end = new Date(Date.now() - 2 * 864e5)
    const start = new Date(end.getTime() - (WINDOW_DAYS - 1) * 864e5)

    let startRow = 0
    let total = 0
    for (;;) {
      const res = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: fmt(start),
            endDate: fmt(end),
            dimensions: ['date', 'page', 'query'],
            rowLimit: 25000,
            startRow,
          }),
        }
      )
      const json = await res.json()
      if (json.error) throw new Error(JSON.stringify(json.error))
      const rows = json.rows ?? []
      if (rows.length === 0) break

      const payload = rows.map((r: { keys: string[]; clicks: number; impressions: number; position: number }) => ({
        date: r.keys[0],
        page: r.keys[1],
        query: r.keys[2],
        clicks: r.clicks,
        impressions: r.impressions,
        position: r.position,
        fetched_at: new Date().toISOString(),
      }))

      for (let i = 0; i < payload.length; i += 1000) {
        const { error } = await supabase
          .from('gsc_daily')
          .upsert(payload.slice(i, i + 1000), { onConflict: 'date,page,query' })
        if (error) throw new Error(`upsert failed: ${error.message}`)
      }

      total += rows.length
      if (rows.length < 25000) break
      startRow += rows.length
    }

    return NextResponse.json({ ok: true, rows: total, window: `${fmt(start)}..${fmt(end)}` })
  } catch (err) {
    console.error('gsc-import failed', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }
}
