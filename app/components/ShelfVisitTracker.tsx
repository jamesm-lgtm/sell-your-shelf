'use client'

import { useEffect } from 'react'
import { getOrCreateSessionId, getLandingReferrer, getLandingUtm } from '@/app/lib/session'
import { isDebugSuppressed } from '@/app/lib/analytics'

export default function ShelfVisitTracker({ username }: { username: string }) {
  useEffect(() => {
    if (isDebugSuppressed()) return
    const sessionId = getOrCreateSessionId()
    const referrer = getLandingReferrer()
    const utm = getLandingUtm()

    fetch('/api/shelf-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, sessionId, referrer, ...utm }),
    }).catch(() => {}) // Silent fail — never block the page
  }, [username])

  return null
}
