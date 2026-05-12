'use client'

import { useBasket } from './BasketProvider'
import type { BasketItem } from '@/app/lib/basket'

const FOREST = '#2D4A3E'
const CREAM = '#FAF8F5'

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
        onClick={() => removeItem(item.listingId)}
        style={{
          display: 'block',
          width: '100%',
          background: '#fff',
          color: FOREST,
          border: `1px solid ${FOREST}`,
          fontSize: 15,
          fontWeight: 600,
          padding: '13px 0',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        ✓ Added — Remove?
      </button>
    )
  }

  return (
    <button
      onClick={() => addItem(seller, item)}
      style={{
        display: 'block',
        width: '100%',
        background: FOREST,
        color: CREAM,
        border: 'none',
        fontSize: 15,
        fontWeight: 600,
        padding: '13px 0',
        borderRadius: 8,
        cursor: 'pointer',
      }}
    >
      Add to basket
    </button>
  )
}
