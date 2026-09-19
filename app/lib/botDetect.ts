import { createHash } from 'node:crypto'
import type { NextRequest } from 'next/server'

// Server-side bot detection for the view-tracking API routes.
//
// Three layers, because no single one is sufficient:
//
//  1. USER AGENT — catches self-identifying crawlers (Googlebot), Google's
//     quieter fetchers (GoogleOther, which carries a plain Chrome UA), and
//     named automation tools including Lightpanda, a headless browser built
//     for scrapers and AI agents.
//  2. IP HASH — recorded here so repeat-offender IPs can be identified. The
//     ip_hash column existed but nothing ever wrote it, so the strongest
//     available signal (hundreds of "sessions" from one address) was
//     unusable. Hashed with a salt: we never store a raw IP.
//  3. BEHAVIOURAL, applied after the fact by flag_scraper_sessions() — a
//     single view, no referrer, non-GB. Can't run at insert time because
//     the session isn't finished yet.
//
// Layer 1 alone caught only ~32% of the August scraper wave: the rest spoof
// ordinary Chrome and Firefox strings, execute JavaScript, and so trip the
// client-side trackers exactly like a person would.

const BOT_UA =
  /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|pingdom|pagespeed|vercel-screenshot|prerender|facebookexternalhit|whatsapp|telegram|discordbot|skypeuripreview|embedly|quora link preview|outbrain|vkshare|w3c_validator|dataminr|axios|python-requests|wget|curl\/|googleother|google-inspectiontool|google-read-aloud|google-site-verification|googleproducer|feedfetcher-google|apis-google|mediapartners-google|google favicon|storebot-google|lightpanda|puppeteer|playwright|selenium|webdriver|scrapy|httpclient|okhttp|java\/|go-http|node-fetch|got\/|phantomjs|chrome-lighthouse|bytespider|gptbot|claudebot|ccbot|perplexitybot|amazonbot|applebot-extended|meta-externalagent/i

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true // no UA at all → not a normal browser
  return BOT_UA.test(userAgent)
}

// Pseudonymised client address. Salted so the hashes are not reversible via
// a rainbow table of the IPv4 space; falls back to a fixed salt so a missing
// env var degrades to "still useful for grouping" rather than throwing.
export function hashClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  const ip = fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
  if (!ip) return null
  const salt = process.env.IP_HASH_SALT ?? 'sys-default-salt'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

/** Everything the tracking routes need to record about the caller. */
export function trafficSignals(req: NextRequest) {
  const userAgent = req.headers.get('user-agent')
  return {
    userAgent,
    isBot: isBotUserAgent(userAgent),
    ipHash: hashClientIp(req),
    country: req.headers.get('x-vercel-ip-country'),
    city: req.headers.get('x-vercel-ip-city'),
  }
}
