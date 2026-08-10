'use client'

// Fires a GA4 purchase event once on mount. Rendered by the confirmation
// pages (server components) with the order/transaction details. GA
// deduplicates by transaction_id, so a page refresh won't double-count.

import { useEffect } from 'react'
import { gaEvent } from '@/app/lib/ga'

type Item = { item_id: string; item_name: string; price?: number }

export default function GaPurchase({
  transactionId,
  value,
  items,
}: {
  transactionId: string
  value: number
  items: Item[]
}) {
  useEffect(() => {
    if (!transactionId) return
    gaEvent('purchase', {
      transaction_id: transactionId,
      currency: 'GBP',
      value,
      items: items.map((it) => ({ ...it, quantity: 1 })),
    })
    // once per confirmation view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId])

  return null
}
