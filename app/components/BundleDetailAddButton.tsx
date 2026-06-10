'use client'

/**
 * BundleDetailAddButton
 *
 * Client island used by the /bundle/[id] product page so the server-
 * rendered shell stays static while the Add-to-Basket action gets
 * useBasket context. Mirrors the add behaviour of BundlesRow /
 * ListingBundleStrip: writes effective prices + bundle context onto
 * each BasketItem so the basket UI's discount-collapse logic works,
 * and checkout charges the discounted total.
 */

import { useBasket } from './BasketProvider'
import type { BasketItem } from '@/app/lib/basket'

const FOREST = '#2D4A3E'

export interface BundleDetailMember {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  condition: string
  format: 'paperback' | 'hardback' | null
  coverUrl: string | null
  category: string | null
  /** Effective post-discount price as computed server-side. */
  effectivePriceGbp: number
  /** Per-line discount amount. */
  discountGbp: number
}

interface Props {
  bundleId: number
  bundleName: string
  members: BundleDetailMember[]
  seller: { sellerId: string; sellerUsername: string }
}

export default function BundleDetailAddButton({
  bundleId,
  bundleName,
  members,
  seller,
}: Props) {
  const { addItems, basket } = useBasket()
  const allInBasket = members.every((m) =>
    basket?.items.some((it) => it.listingId === m.id),
  )

  const handleAdd = () => {
    const items: BasketItem[] = members.map((m) => ({
      listingId: m.id,
      title: m.title,
      author: m.author,
      // Server-computed effective price; matches the discount the
      // checkout server will actually apply via the all-members-
      // present gate.
      priceGbp: m.effectivePriceGbp,
      format: m.format,
      coverUrl: m.coverUrl,
      category: m.category,
      bundleId,
      originalPriceGbp: Number(m.asking_price_gbp),
      bundleDiscountGbp: m.discountGbp,
      bundleTotalMembers: members.length,
    }))
    addItems(seller, items, 'bundle')
  }

  return (
    <button
      onClick={handleAdd}
      disabled={allInBasket}
      style={{
        background: allInBasket ? '#E5E3DF' : FOREST,
        color: allInBasket ? '#999' : '#FAF8F5',
        border: 'none',
        fontSize: 15,
        fontWeight: 600,
        padding: '12px 0',
        borderRadius: 8,
        cursor: allInBasket ? 'default' : 'pointer',
        width: '100%',
      }}
      aria-label={allInBasket ? 'Bundle already in basket' : `Add "${bundleName}" to basket`}
    >
      {allInBasket
        ? 'In basket'
        : `Add ${members.length} ${members.length === 1 ? 'book' : 'books'} to basket`}
    </button>
  )
}
