'use client'

import { useEffect } from 'react'
import { getOrCreateSessionId, getLandingReferrer, getLandingUtm } from '@/app/lib/session'
import { isDebugSuppressed } from '@/app/lib/analytics'

// Book aggregation pages are the primary organic-search landing surface,
// but had no view tracking at all until this — listing_views only covers
// /listing/[id], so search traffic was invisible in the funnel.
export default function BookViewTracker({ bookId, slug }: { bookId: number; slug: string }) {
  useEffect(() => {
    if (isDebugSuppressed()) return
    const sessionId = getOrCreateSessionId()
    const referrer = getLandingReferrer()
    const utm = getLandingUtm()

    fetch('/api/book-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, slug, sessionId, referrer, ...utm }),
    }).catch(() => {}) // Silent fail — never block the page
  }, [bookId, slug])

  return null
}
