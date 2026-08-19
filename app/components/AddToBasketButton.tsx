'use client'

import { useBasket } from './BasketProvider'
import type { BasketItem } from '@/app/lib/basket'

const FOREST = 'var(--color-ground)'
const CREAM = 'var(--color-paper)'

type Props = {
  seller: { sellerId: string; sellerUsername: string }
  item: BasketItem
}

export default function AddToBasketButton({ seller, item }: Props) {
  const { hasItem, addItem, removeItem } = useBasket()
  const inBasket = hasItem(item.listingId)

  if (inBasket) {
    return (
      <button
        onClick={() => removeItem(item.listingId, 'card_toggle')}
        style={{
          display: 'block',
          width: '100%',
          background: 'var(--color-sheet)',
          color: 'var(--color-action)',
          border: '1px solid var(--color-action)',
          fontSize: 15,
          fontWeight: 600,
          padding: '13px 0',
          borderRadius: 999,
          cursor: 'pointer',
        }}
      >
        ✓ Added — Remove?
      </button>
    )
  }

  return (
    <button
      onClick={() => addItem(seller, item, 'listing_page')}
      style={{
        display: 'block',
        width: '100%',
        background: 'var(--color-action)',
        color: '#fff',
        border: 'none',
        fontSize: 15,
        fontWeight: 600,
        padding: '13px 0',
        borderRadius: 999,
        cursor: 'pointer',
      }}
    >
      Add to basket
    </button>
  )
}
