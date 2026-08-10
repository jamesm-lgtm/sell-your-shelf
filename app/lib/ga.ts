// Google Analytics 4 helpers.
//
// GA is the audience/acquisition layer only — the first-party pipeline
// (book_views / listing_views / events / transactions) remains the source
// of truth for funnel and revenue. Expect GA numbers to read lower
// (ad-blockers, declined consent); do not reconcile the two.

export const GA_ID = 'G-JDDP3MZ7CZ'

export const CONSENT_KEY = 'sys_analytics_consent'

type GtagFn = (...args: unknown[]) => void

function gtag(): GtagFn | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { gtag?: GtagFn }).gtag ?? null
}

export function gaEvent(name: string, params?: Record<string, unknown>): void {
  gtag()?.('event', name, params ?? {})
}

export function gaGrantConsent(): void {
  gtag()?.('consent', 'update', { analytics_storage: 'granted' })
}
