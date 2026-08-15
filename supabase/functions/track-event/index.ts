// track-event: receives a batched POST of analytics events from the web app
// and bulk-inserts them into the `events` table.
//
// Deployed with --no-verify-jwt because traffic is anonymous web visitors,
// not authenticated users. Defenses against abuse:
//   - Origin allowlist (sellyourshelf.com + staging vercel previews + localhost)
//   - In-memory rate limit (per isolate; stops casual abuse, not paranoid-grade)
//   - Test-account filter on user_id (cached against `users` table)
//   - Batch size cap (50)
//   - Schema validation per row
//
// Server-side enrichment per row:
//   - user_agent: copied from the request
//   - ip_hash:    sha256(ip + IP_HASH_SALT), hex. IP itself never stored.
//   - is_bot:     true when user_agent matches the bot regex below.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS_EXACT = new Set([
  'https://sellyourshelf.com',
  'https://www.sellyourshelf.com',
  'http://localhost:3000',
])

// Vercel preview / staging deploys. Tightened to the sell-your-shelf project
// pattern so we don't accept events from arbitrary *.vercel.app hosts.
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/sell-your-shelf(-[a-z0-9-]+)?\.vercel\.app$/,
  /^https:\/\/sell-your-shelf-[a-z0-9-]+-james-mumbersons-projects\.vercel\.app$/,
]

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false
  if (ALLOWED_ORIGINS_EXACT.has(origin)) return true
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin))
}

const TEST_USERNAMES = ['jmumberson', 'igor', 'tahleel', 'shojin', 'sapling']
const VALID_PLATFORMS = new Set(['web', 'ios', 'android'])

const MAX_BATCH = 50
const RATE_LIMIT_MAX = 100
const RATE_LIMIT_WINDOW_MS = 60_000
const TEST_USER_CACHE_TTL_MS = 60_000

// Bot detection on user-agent. Conservative — matches the most common bots,
// crawlers, dev tools, and headless browsers. False negatives are preferable
// to false positives (we'd rather count a few bots than discard real traffic).
const BOT_UA_REGEX =
  /bot|crawler|spider|crawling|preview|fetch|monitor|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex|sogou|facebook|twitter|linkedin|whatsapp|telegram|discord|slack|headless|phantom|selenium|playwright|puppeteer|curl|wget|python-requests|axios|node-fetch/i

function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false
  return BOT_UA_REGEX.test(userAgent)
}

// SHA-256 hex of `${ip}:${salt}`. Lets us count unique-ish visitors without
// retaining the IP itself. Same input -> same output, so we can group, but
// can't reverse to the original IP without the salt.
let ipSaltWarned = false
async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get('IP_HASH_SALT')
  if (!salt) {
    if (!ipSaltWarned) {
      console.warn('IP_HASH_SALT not set — using a process-local fallback. Set the secret to enable stable hashing.')
      ipSaltWarned = true
    }
  }
  const material = `${ip}:${salt ?? 'unsalted'}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

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
  const allow = isAllowedOrigin(origin) ? origin! : ''
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

  // Native iOS/Android apps send no Origin header at all — only browsers do —
  // so the allowlist was silently 403ing every event the mobile app emitted.
  // That cost us the entire scan funnel: the app has always sent scan_started
  // and scan_failed (see components/Scanner/hooks/useVideoProcessor.ts), and
  // every one was discarded. During the 2026-06-15 scanner outage that left no
  // record whatsoever of who tried to scan and why it failed — the single most
  // useful thing we could have had.
  //
  // Absent Origin is therefore allowed. It is not a security downgrade worth
  // worrying about: an Origin header is trivially forged by any non-browser
  // client, so it was never an authentication control. The real defences are
  // unchanged — per-IP rate limiting, batch cap, per-row schema validation,
  // test-account filtering and bot detection.
  if (origin !== null && !isAllowedOrigin(origin)) {
    return new Response('forbidden', { status: 403, headers })
  }

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  const userAgent = req.headers.get('user-agent')

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

  // Compute server-side enrichment once per request (same for every event).
  const ip_hash = ip === 'unknown' ? null : await hashIp(ip)
  const is_bot = isBot(userAgent)

  const rows = filtered.map((e) => ({
    event_name: e.event_name,
    session_id: e.session_id,
    user_id:    e.user_id,
    listing_id: e.listing_id,
    seller_id:  e.seller_id,
    source:     e.source,
    platform:   e.platform,
    properties: e.properties,
    user_agent: userAgent,
    ip_hash,
    is_bot,
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
