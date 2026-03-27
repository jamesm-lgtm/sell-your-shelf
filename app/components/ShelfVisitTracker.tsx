'use client'

import { useEffect } from 'react'
import { getOrCreateSessionId } from '@/app/lib/session'

export default function ShelfVisitTracker({ username }: { username: string }) {
  useEffect(() => {
    const sessionId = getOrCreateSessionId()

    fetch('/api/shelf-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, sessionId }),
    }).catch(() => {}) // Silent fail — never block the page
  }, [username])

  return null
}
