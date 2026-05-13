'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useBasket } from './BasketProvider'
import type { BasketItem } from '@/app/lib/basket'

type Listing = {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  condition: string
  format?: 'paperback' | 'hardback' | null
  books: { cover_url: string | null; cover_url_hosted?: string | null; category?: string | null } | null
  users?: { username: string } | null
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

const FOREST = '#2D4A3E'
const CREAM = '#FAF8F5'

function listingToBasketItem(l: Listing): BasketItem {
  return {
    listingId: l.id,
    title: l.title,
    author: l.author,
    priceGbp: Number(l.asking_price_gbp),
    format: l.format ?? null,
    coverUrl: l.books?.cover_url_hosted || l.books?.cover_url || null,
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleFilterChange('all')}
            style={{ fontSize: 13, padding: '6px 14px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', background: condition === 'all' ? '#2D4A3E' : '#fff', color: condition === 'all' ? '#FAF8F5' : '#666', borderColor: condition === 'all' ? '#2D4A3E' : '#E5E3DF' }}
          >
            All
          </button>
          {activeConditions.map(c => (
            <button
              key={c}
              onClick={() => handleFilterChange(c)}
              style={{ fontSize: 13, padding: '6px 14px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer', background: condition === c ? '#2D4A3E' : '#fff', color: condition === c ? '#FAF8F5' : '#666', borderColor: condition === c ? '#2D4A3E' : '#E5E3DF' }}
            >
              {CONDITIONS[c] ?? c}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={e => setSort(e.target.value as any)}
          style={{ fontSize: 13, padding: '6px 12px', borderRadius: 6, border: '0.5px solid #E5E3DF', background: '#fff', color: '#1A1A1A', cursor: 'pointer' }}
        >
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>

      {/* Results count */}
      <p style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>
        {filtered.length} {filtered.length === 1 ? 'book' : 'books'}
        {condition !== 'all' ? ` in ${CONDITIONS[condition]}` : ''}
      </p>

      {filtered.length === 0 ? (
        <p style={{ color: '#999', fontSize: 15, textAlign: 'center', paddingTop: 48 }}>
          No books match this filter.
        </p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
            {visible.map((listing) => {
              const inBasket = hasItem(listing.id)
              return (
                <div key={listing.id} style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ aspectRatio: '2/3', background: '#2D4A3E', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {(listing.books?.cover_url_hosted || listing.books?.cover_url) ? (
                      <img
                        src={listing.books.cover_url_hosted || listing.books.cover_url!}
                        alt={listing.title}
                        style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, padding: 8, textAlign: 'center' }}>
                        {listing.title}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: 12, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', lineHeight: 1.3, marginBottom: 3 }}>
                      {listing.title}
                    </div>
                    {listing.author && (
                      <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                        {listing.author}
                      </div>
                    )}
                    {showSeller && listing.users?.username && (
                      <Link
                        href={`/${listing.users.username}`}
                        style={{ fontSize: 11, color: '#2D4A3E', textDecoration: 'none', display: 'block', marginBottom: 8 }}
                      >
                        @{listing.users.username}
                      </Link>
                    )}
                    <div style={{ marginTop: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 15, fontWeight: 500, color: '#2D4A3E' }}>
                          £{Number(listing.asking_price_gbp).toFixed(2)}
                        </span>
                        <span style={{ fontSize: 11, color: '#666', background: '#F0EDE8', padding: '3px 8px', borderRadius: 4 }}>
                          {CONDITIONS[listing.condition] ?? listing.condition}
                        </span>
                      </div>

                      {sellerRef ? (
                        inBasket ? (
                          <button
                            onClick={() => removeItem(listing.id)}
                            style={addedButtonStyle}
                          >
                            <span aria-hidden style={{ marginRight: 6 }}>✓</span>
                            Added — Remove?
                          </button>
                        ) : (
                          <button
                            onClick={() => addItem(sellerRef, listingToBasketItem(listing))}
                            style={primaryButtonStyle}
                          >
                            Add to basket
                          </button>
                        )
                      ) : (
                        // No seller context — fall back to original CTA
                        <Link
                          href={`/listing/${listing.id}`}
                          style={{ display: 'block', textAlign: 'center', background: FOREST, color: CREAM, fontSize: 13, fontWeight: 500, padding: '9px 0', borderRadius: 6, textDecoration: 'none' }}
                        >
                          View listing
                        </Link>
                      )}

                      {sellerRef && (
                        <Link
                          href={`/listing/${listing.id}`}
                          style={{
                            display: 'block',
                            textAlign: 'center',
                            color: '#666',
                            fontSize: 12,
                            textDecoration: 'underline',
                            marginTop: 8,
                          }}
                        >
                          View listing
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <button
                onClick={() => setVisibleCount(prev => prev + pageSize)}
                style={{
                  background: '#fff',
                  border: '1px solid #2D4A3E',
                  color: '#2D4A3E',
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

const primaryButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: BUTTON_MIN_HEIGHT,
  textAlign: 'center',
  background: FOREST,
  color: CREAM,
  fontSize: 13,
  fontWeight: 500,
  padding: '6px 8px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  lineHeight: 1.25,
}

const addedButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: BUTTON_MIN_HEIGHT,
  textAlign: 'center',
  background: '#fff',
  color: FOREST,
  fontSize: 13,
  fontWeight: 500,
  padding: '6px 8px',
  borderRadius: 6,
  border: `1px solid ${FOREST}`,
  cursor: 'pointer',
  lineHeight: 1.25,
}
