// track-event: receives a batched POST of analytics events from the web app
// and bulk-inserts them into the `events` table.
//
// Deployed with --no-verify-jwt because traffic is anonymous web visitors,
// not authenticated users. Defenses against abuse:
//   - Origin allowlist (sellyourshelf.com + localhost)
//   - In-memory rate limit (per isolate; stops casual abuse, not paranoid-grade)
//   - Test-account filter on user_id (cached against `users` table)
//   - Batch size cap (50)
//   - Schema validation per row

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set([
  'https://sellyourshelf.com',
  'https://www.sellyourshelf.com',
  'http://localhost:3000',
])

const TEST_USERNAMES = ['jmumberson', 'igor', 'tahleel', 'shojin', 'sapling']
const VALID_PLATFORMS = new Set(['web', 'ios', 'android'])

const MAX_BATCH = 50
const RATE_LIMIT_MAX = 100
const RATE_LIMIT_WINDOW_MS = 60_000
const TEST_USER_CACHE_TTL_MS = 60_000

// Per-isolate rate limit. Distributed isolates each track independently, so
// the effective rate is higher than the configured limit — adequate for
// stopping casual abuse, not paranoid-grade.
const ipBuckets = new Map<string, { count: number; resetAt: number }>()

function checkRate(ip: string, n: number): boolean {
  const now = Date.now()
  const bucket = ipBuckets.get(ip)
  if (!bucket || bucket.resetAt < now) {
    ipBuckets.set(ip, { count: n, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return n <= RATE_LIMIT_MAX
  }
  bucket.count += n
  return bucket.count <= RATE_LIMIT_MAX
}

let testUserCache: { ids: Set<string>; loadedAt: number } | null = null

async function getTestUserIds(supabase: SupabaseClient): Promise<Set<string>> {
  const now = Date.now()
  if (testUserCache && now - testUserCache.loadedAt < TEST_USER_CACHE_TTL_MS) {
    return testUserCache.ids
  }
  const { data } = await supabase
    .from('users')
    .select('id')
    .in('username', TEST_USERNAMES)
  const ids = new Set<string>((data ?? []).map((u: { id: string }) => u.id))
  testUserCache = { ids, loadedAt: now }
  return ids
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

interface IncomingEvent {
  event_name?: unknown
  session_id?: unknown
  user_id?: unknown
  listing_id?: unknown
  seller_id?: unknown
  source?: unknown
  platform?: unknown
  properties?: unknown
}

interface ValidEvent {
  event_name: string
  session_id: string
  user_id: string | null
  listing_id: number | null
  seller_id: string | null
  source: string | null
  platform: string
  properties: Record<string, unknown>
}

function validate(e: IncomingEvent): ValidEvent | null {
  if (!e || typeof e.event_name !== 'string' || e.event_name.length === 0) return null
  if (typeof e.session_id !== 'string' || e.session_id.length === 0) return null

  const platform = typeof e.platform === 'string' ? e.platform : 'web'
  if (!VALID_PLATFORMS.has(platform)) return null

  return {
    event_name: e.event_name,
    session_id: e.session_id,
    user_id:    typeof e.user_id    === 'string' ? e.user_id    : null,
    listing_id: typeof e.listing_id === 'number' ? e.listing_id : null,
    seller_id:  typeof e.seller_id  === 'string' ? e.seller_id  : null,
    source:     typeof e.source     === 'string' ? e.source     : null,
    platform,
    properties: e.properties && typeof e.properties === 'object' && !Array.isArray(e.properties)
      ? (e.properties as Record<string, unknown>)
      : {},
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return new Response('forbidden', { status: 403, headers })
  }

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'

  let body: { events?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response('invalid json', { status: 400, headers })
  }

  const incoming = Array.isArray(body?.events) ? (body.events as IncomingEvent[]) : []
  if (incoming.length === 0) {
    return new Response('no events', { status: 400, headers })
  }
  if (incoming.length > MAX_BATCH) {
    return new Response('batch too large', { status: 400, headers })
  }

  if (!checkRate(ip, incoming.length)) {
    return new Response('rate limited', { status: 429, headers })
  }

  const valid = incoming.map(validate).filter((e): e is ValidEvent => e !== null)
  if (valid.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, inserted: 0, skipped: incoming.length }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const testIds = await getTestUserIds(supabase)
  const filtered = valid.filter((e) => !e.user_id || !testIds.has(e.user_id))

  const rows = filtered.map((e) => ({
    event_name: e.event_name,
    session_id: e.session_id,
    user_id:    e.user_id,
    listing_id: e.listing_id,
    seller_id:  e.seller_id,
    source:     e.source,
    platform:   e.platform,
    properties: e.properties,
  }))

  const { error } = await supabase.from('events').insert(rows)

  if (error) {
    console.error('events insert failed', error)
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ ok: true, inserted: rows.length, skipped: incoming.length - rows.length }),
    { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } },
  )
})
