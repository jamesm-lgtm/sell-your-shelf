'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useBasket } from './BasketProvider'
import type { BasketItem } from '@/app/lib/basket'
import { BookCard, BookGrid } from '@/app/components/ui'
import { resolveBookCover, type ListingImageRow } from '@/app/lib/coverUrl'

type Listing = {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  condition: string
  format?: 'paperback' | 'hardback' | null
  books: { cover_url: string | null; cover_url_hosted?: string | null; category?: string | null } | null
  listing_images?: ListingImageRow[] | null
  users?: { username: string } | null
  // Slice 10: true iff this listing is in an active bundle. Drives a
  // small "Bundle" badge in the corner of the cover so buyers know
  // they could save by viewing the seller's shelf.
  has_bundles?: boolean
}

type Props = {
  listings: Listing[]
  showSeller?: boolean
  pageSize?: number
  seller?: { sellerId: string; sellerUsername: string }
}

const CONDITIONS: Record<string, string> = {
  like_new: 'Like New',
  very_good: 'Very Good',
  good: 'Good',
  acceptable: 'Acceptable',
}

const CONDITION_ORDER: Record<string, number> = {
  like_new: 0,
  very_good: 1,
  good: 2,
  acceptable: 3,
}

const FOREST = 'var(--color-ground)'
const CREAM = 'var(--color-paper)'

function listingToBasketItem(l: Listing): BasketItem {
  return {
    listingId: l.id,
    title: l.title,
    author: l.author,
    priceGbp: Number(l.asking_price_gbp),
    format: l.format ?? null,
    coverUrl: resolveBookCover(l.books, l.listing_images),
    category: l.books?.category ?? null,
  }
}

export default function ShelfGrid({ listings, showSeller = false, pageSize = 24, seller }: Props) {
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest')
  const [condition, setCondition] = useState<string>('all')
  const [visibleCount, setVisibleCount] = useState(pageSize)

  const { hasItem, addItem, removeItem } = useBasket()

  const filtered = listings
    .filter(l => condition === 'all' || l.condition === condition)
    .sort((a, b) => {
      if (sort === 'price_asc') return a.asking_price_gbp - b.asking_price_gbp
      if (sort === 'price_desc') return b.asking_price_gbp - a.asking_price_gbp
      return 0
    })

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length

  const activeConditions = Array.from(new Set(listings.map(l => l.condition)))
    .sort((a, b) => CONDITION_ORDER[a] - CONDITION_ORDER[b])

  const handleFilterChange = (newCondition: string) => {
    setCondition(newCondition)
    setVisibleCount(pageSize)
  }

  // Only enable add-to-basket when grid is bound to a single seller (shelf page).
  // Multi-seller views (category, browse, new) fall through to "View listing".
  const sellerRef = seller ?? null

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        {/* Condition chips removed: 92% of live stock is Very Good or better,
            so the filter's options were effectively 92%/8% — it filtered
            almost nothing while taking the most prominent row on the shelf.
            Condition still shows per card and on the listing page. */}
        <div />

        <select
          value={sort}
          onChange={e => setSort(e.target.value as any)}
          className="sy-select"
        >
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>

      {/* Results count */}
      <p style={{ fontSize: 13, color: 'var(--color-ink-faint)', marginBottom: 16 }}>
        {filtered.length} {filtered.length === 1 ? 'book' : 'books'}
        {condition !== 'all' ? ` in ${CONDITIONS[condition]}` : ''}
      </p>

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--color-ink-faint)', fontSize: 15, textAlign: 'center', paddingTop: 48 }}>
          No books match this filter.
        </p>
      ) : (
        <>
          <BookGrid>
            {visible.map((listing) => {
              const inBasket = hasItem(listing.id)
              return (
                <BookCard
                  key={listing.id}
                  href={`/listing/${listing.id}`}
                  book={{
                    id: listing.id,
                    title: listing.title,
                    author: listing.author,
                    price: Number(listing.asking_price_gbp),
                    condition: listing.condition,
                    cover: resolveBookCover(listing.books, listing.listing_images),
                    inBundle: listing.has_bundles,
                  }}
                  action={
                    sellerRef ? (
                      inBasket ? (
                        <button
                          onClick={() => removeItem(listing.id, 'card_toggle')}
                          style={addedButtonStyle}
                        >
                          <span aria-hidden>✓</span> In basket · Remove
                        </button>
                      ) : (
                        <button
                          onClick={() => addItem(sellerRef, listingToBasketItem(listing), 'shelf_card')}
                          style={primaryButtonStyle}
                        >
                          Add to basket
                        </button>
                      )
                    ) : undefined
                  }
                />
              )
            })}
          </BookGrid>

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <button
                onClick={() => setVisibleCount(prev => prev + pageSize)}
                style={{
                  background: '#fff',
                  border: '1px solid #2D4A3E',
                  color: 'var(--color-ground)',
                  fontSize: 14,
                  fontWeight: 500,
                  padding: '12px 40px',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Load more ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Reserve enough vertical space for the longer "✓ Added — Remove?" wrap so
// toggling never shifts surrounding cards in the grid row.
const BUTTON_MIN_HEIGHT = 52

// Both states share geometry so the grid never shifts when one flips.
const buttonBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  width: '100%',
  minHeight: BUTTON_MIN_HEIGHT,
  textAlign: 'center',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 600,
  padding: '10px 12px',
  borderRadius: 999,
  cursor: 'pointer',
  lineHeight: 1.25,
}

const primaryButtonStyle: React.CSSProperties = {
  ...buttonBase,
  background: 'var(--color-action)',
  color: '#fff',
  border: '1px solid var(--color-action)',
}

// A settled state, not a second primary action: quiet fill, hairline
// border, ink text. It should recede once the job is done.
const addedButtonStyle: React.CSSProperties = {
  ...buttonBase,
  background: 'var(--color-paper-warm)',
  color: 'var(--color-ink)',
  // ink-faint, not rule: --color-rule is 1.35:1 against the paper ground,
  // so the button had no legible boundary. This is 4.73:1.
  border: '1px solid var(--color-ink-faint)',
  fontWeight: 500,
}
