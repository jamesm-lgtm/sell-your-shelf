'use client'

// Lightweight analytics client for the web app. Calls track() are batched and
// flushed to the track-event Edge Function via sendBeacon. The function
// inserts into the `events` table.
//
// Developer filter: appending ?debug=1 to any URL on the site sets a flag in
// localStorage that suppresses every track() call, all three view trackers
// (book/listing/shelf), and GA page views — for this browser, permanently.
// Useful for QA / dogfooding without polluting analytics. Clear it with
// ?debug=0 on any URL (or `localStorage.removeItem('sys_debug_no_track')`).

import { getOrCreateSessionId } from '@/app/lib/session'

const ENDPOINT = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/track-event`
const FLUSH_DEBOUNCE_MS = 2000
const FLUSH_THRESHOLD = 10
const MAX_BATCH = 50

const DEBUG_FLAG_KEY = 'sys_debug_no_track'

type EventProperties = Record<string, unknown>

interface TrackOptions {
  source?: string
  listingId?: number | null
  sellerId?: string | null
}

interface QueuedEvent {
  event_name: string
  session_id: string
  platform: 'web'
  properties: EventProperties
  source: string | null
  listing_id: number | null
  seller_id: string | null
  // user_id is intentionally omitted — web has no server-side auth session.
  // Mobile will populate this from its own analytics layer.
}

let queue: QueuedEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let pageHideAttached = false

export function track(
  eventName: string,
  properties: EventProperties = {},
  opts: TrackOptions = {},
): void {
  if (typeof window === 'undefined') return
  if (isDebugSuppressed()) return

  queue.push({
    event_name: eventName,
    session_id: getOrCreateSessionId(),
    platform: 'web',
    properties,
    source: opts.source ?? null,
    listing_id: opts.listingId ?? null,
    seller_id: opts.sellerId ?? null,
  })

  attachPageHideListener()

  if (queue.length >= FLUSH_THRESHOLD) {
    flush()
  } else {
    scheduleFlush()
  }
}

function scheduleFlush() {
  if (flushTimer !== null) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
  }, FLUSH_DEBOUNCE_MS)
}

function flush() {
  if (queue.length === 0) return
  if (flushTimer !== null) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  const batch = queue.splice(0, MAX_BATCH)
  const payload = JSON.stringify({ events: batch })

  // sendBeacon survives page unloads and is fire-and-forget, which is exactly
  // what we want for analytics.
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([payload], { type: 'application/json' })
    const ok = navigator.sendBeacon(ENDPOINT, blob)
    if (ok) return
  }

  // Fallback for older browsers / sendBeacon failure (queue full, etc.).
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {})
}

function attachPageHideListener() {
  if (pageHideAttached || typeof window === 'undefined') return
  pageHideAttached = true
  window.addEventListener('pagehide', flush)
}

// Exported so the view trackers (BookViewTracker etc.) and GaPageViews can
// honour the same opt-out. ?debug=1 sets the flag, ?debug=0 clears it;
// between those, the URL no longer matters. localStorage scope: survives
// tabs and restarts — set it once per browser/device you use.
export function isDebugSuppressed(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('debug') === '1') {
      localStorage.setItem(DEBUG_FLAG_KEY, '1')
      // Migrate: older sessions used sessionStorage
      sessionStorage.removeItem(DEBUG_FLAG_KEY)
    } else if (params.get('debug') === '0') {
      localStorage.removeItem(DEBUG_FLAG_KEY)
      sessionStorage.removeItem(DEBUG_FLAG_KEY)
    }

    return (
      localStorage.getItem(DEBUG_FLAG_KEY) === '1' ||
      sessionStorage.getItem(DEBUG_FLAG_KEY) === '1'
    )
  } catch {
    return false
  }
}
