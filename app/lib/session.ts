// Client-side only — generates and persists a session ID in localStorage
// Persists across page navigations within a browser session

const SESSION_KEY = 'sys_session_id'
const LANDING_REFERRER_KEY = 'sys_landing_referrer'

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''

  let sessionId = localStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, sessionId)
  }
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
