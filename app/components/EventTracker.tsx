'use client'

import { useEffect } from 'react'
import { track } from '@/app/lib/analytics'

interface Props {
  eventName: string
  properties?: Record<string, unknown>
  source?: string
  listingId?: number | null
  sellerId?: string | null
}

// Fires a single track() call on mount. Used for page-view style events
// (category_view, search_performed, checkout_started) and other events that
// can be expressed declaratively rather than through an explicit handler.
export default function EventTracker({
  eventName,
  properties,
  source,
  listingId,
  sellerId,
}: Props) {
  useEffect(() => {
    track(eventName, properties ?? {}, {
      source,
      listingId: listingId ?? null,
      sellerId: sellerId ?? null,
    })
    // We intentionally fire once per mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
