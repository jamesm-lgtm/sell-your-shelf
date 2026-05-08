// Client-side only — generates and persists a session ID in sessionStorage.
// Sessions reset when the browser tab closes or after 30 minutes of inactivity.

const SESSION_KEY = 'sys_session_id'
const SESSION_LAST_ACTIVITY_KEY = 'sys_session_last_activity'
const LANDING_REFERRER_KEY = 'sys_landing_referrer'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''

  const now = Date.now()
  const lastActivityRaw = sessionStorage.getItem(SESSION_LAST_ACTIVITY_KEY)
  const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : 0
  const idleExpired = lastActivity > 0 && now - lastActivity > IDLE_TIMEOUT_MS

  let sessionId = sessionStorage.getItem(SESSION_KEY)
  if (!sessionId || idleExpired) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, sessionId)
  }

  sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(now))
  return sessionId
}

// Captured on the first page load of a browser tab session and held in
// sessionStorage so every event in that session reports the same entry-point
// referrer (e.g. https://www.google.com/) instead of the immediate previous
// in-site page.
export function getLandingReferrer(): string | null {
  if (typeof window === 'undefined') return null

  let referrer = sessionStorage.getItem(LANDING_REFERRER_KEY)
  if (referrer === null) {
    referrer = document.referrer || ''
    sessionStorage.setItem(LANDING_REFERRER_KEY, referrer)
  }
  return referrer || null
}

const LANDING_UTM_KEY = 'sys_landing_utm'

export interface LandingUtm {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
}

const EMPTY_UTM: LandingUtm = { utm_source: null, utm_medium: null, utm_campaign: null }

// UTM params live on the entry URL — once the user clicks an internal link
// they're gone from `window.location.search`. Capture once on first page load
// of the tab session and reuse for every subsequent event.
export function getLandingUtm(): LandingUtm {
  if (typeof window === 'undefined') return EMPTY_UTM

  const stored = sessionStorage.getItem(LANDING_UTM_KEY)
  if (stored !== null) {
    try {
      return JSON.parse(stored) as LandingUtm
    } catch {
      return EMPTY_UTM
    }
  }

  const params = new URLSearchParams(window.location.search)
  const utm: LandingUtm = {
    utm_source:   params.get('utm_source'),
    utm_medium:   params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
  }
  sessionStorage.setItem(LANDING_UTM_KEY, JSON.stringify(utm))
  return utm
}
