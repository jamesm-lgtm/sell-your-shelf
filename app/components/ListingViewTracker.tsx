'use client'

import { useEffect } from 'react'
import { getOrCreateSessionId, getLandingReferrer, getLandingUtm } from '@/app/lib/session'
import { isDebugSuppressed } from '@/app/lib/analytics'

export default function ListingViewTracker({ listingId }: { listingId: number }) {
  useEffect(() => {
    if (isDebugSuppressed()) return
    const sessionId = getOrCreateSessionId()
    const referrer = getLandingReferrer()
    const utm = getLandingUtm()

    fetch('/api/listing-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, sessionId, referrer, ...utm }),
    }).catch(() => {}) // Silent fail — never block the page
  }, [listingId])

  return null
}
