'use client'

import Link from 'next/link'
import { CSSProperties, ReactNode } from 'react'
import { track } from '@/app/lib/analytics'

interface Props {
  listingId: number
  sellerId?: string | null
  source?: string
  style?: CSSProperties
  children: ReactNode
}

// Wraps the "Buy Now" link with a listing_pay_clicked event so we can measure
// purchase intent independently of whether the user actually completes
// checkout.
export default function BuyNowLink({
  listingId,
  sellerId,
  source = 'book_detail',
  style,
  children,
}: Props) {
  return (
    <Link
      href={`/checkout/${listingId}`}
      onClick={() => {
        track(
          'listing_pay_clicked',
          {},
          { source, listingId, sellerId: sellerId ?? null },
        )
      }}
      style={style}
    >
      {children}
    </Link>
  )
}
