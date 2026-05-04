'use client'

import { useEffect } from 'react'
import { getOrCreateSessionId } from '@/app/lib/session'

export default function ListingViewTracker({ listingId }: { listingId: number }) {
  useEffect(() => {
    const sessionId = getOrCreateSessionId()

    fetch('/api/listing-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingId,
        sessionId,
        referrer: document.referrer || null,
      }),
    }).catch(() => {}) // Silent fail — never block the page
  }, [listingId])

  return null
}
