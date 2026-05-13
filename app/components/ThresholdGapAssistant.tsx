'use client'

import { useEffect, useMemo, useState } from 'react'
import { useBasket, useBasketShipping } from './BasketProvider'
import {
  buildSuggestions,
  Candidate,
  Suggestion,
  BasketItem,
} from '@/app/lib/basket'

const FOREST = '#2D4A3E'
const FOREST_DEEP = '#1F3329'
const GOLD = '#C9A961'

type Listing = {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  format?: 'paperback' | 'hardback' | null
  books: { cover_url: string | null; cover_url_hosted?: string | null; category?: string | null } | null
}

type Props = {
  listings: Listing[]
  seller: { sellerId: string; sellerUsername: string }
}

const DEBOUNCE_MS = 300

export default function ThresholdGapAssistant({ listings, seller }: Props) {
  const { basket, addItems } = useBasket()
  const { state } = useBasketShipping()

  // Debounce the *inputs* to the suggestion engine so rapid clicks don't jitter.
  const [debouncedGap, setDebouncedGap] = useState<number | null>(null)
  const gap = state.kind === 'below' ? state.gapGbp : null

  useEffect(() => {
    const t = setTimeout(() => setDebouncedGap(gap), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [gap])

  const basketIds = useMemo(
    () => new Set(basket?.items.map((it) => it.listingId) ?? []),
    [basket],
  )
  const basketCategories = useMemo(
    () => new Set((basket?.items ?? []).map((it) => it.category).filter((c): c is string => !!c)),
    [basket],
  )

  const candidates: Candidate[] = useMemo(
    () =>
      listings
        .filter((l) => !basketIds.has(l.id))
        .map((l) => ({
          listingId: l.id,
          priceGbp: Number(l.asking_price_gbp),
          category: l.books?.category ?? null,
        })),
    [listings, basketIds],
  )

  const suggestions: Suggestion[] = useMemo(() => {
    if (debouncedGap === null || debouncedGap <= 0) return []
    return buildSuggestions({
      candidates,
      gapGbp: debouncedGap,
      basketCategories,
      maxSuggestions: 3,
    })
  }, [debouncedGap, candidates, basketCategories])

  // Hide when basket empty, when threshold met, when oversized, or when no candidates.
  if (!basket || state.kind !== 'below' || suggestions.length === 0) return null

  const byId = new Map<number, Listing>(listings.map((l) => [l.id, l]))

  const handleAdd = (suggestion: Suggestion) => {
    const items: BasketItem[] = []
    for (const c of suggestion.items) {
      const l = byId.get(c.listingId)
      if (!l) continue
      items.push({
        listingId: l.id,
        title: l.title,
        author: l.author,
        priceGbp: Number(l.asking_price_gbp),
        format: l.format ?? null,
        coverUrl: l.books?.cover_url_hosted || l.books?.cover_url || null,
        category: l.books?.category ?? null,
      })
    }
    addItems(seller, items)
  }

  return (
    <section
      aria-label="Get to free shipping"
      style={{
        marginBottom: 24,
        padding: '14px 16px 14px',
        borderRadius: 10,
        background: '#FFFDF6',
        border: `1px solid ${GOLD}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: FOREST_DEEP, margin: 0 }}>
          Get to free shipping
        </h2>
        <span style={{ fontSize: 12, color: '#999' }}>
          £{state.gapGbp.toFixed(2)} to go
        </span>
      </div>
      <p style={{ fontSize: 13, color: '#666', margin: '4px 0 12px' }}>
        Add one of these to unlock free postage on this order.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {suggestions.map((s, idx) => {
          const previewBooks = s.items.map((c) => byId.get(c.listingId)).filter(Boolean) as Listing[]
          const headline =
            previewBooks.length === 1
              ? `Add this book for £${s.totalGbp.toFixed(2)} to unlock free shipping`
              : `Add these ${previewBooks.length} books for £${s.totalGbp.toFixed(2)} to unlock free shipping`

          return (
            <div
              key={idx}
              style={{
                background: '#fff',
                border: `1px solid ${GOLD}`,
                borderRadius: 10,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                {previewBooks.map((b) => {
                  const cover = b.books?.cover_url_hosted || b.books?.cover_url
                  return (
                    <div
                      key={b.id}
                      style={{
                        width: 44,
                        height: 66,
                        background: FOREST,
                        borderRadius: 3,
                        overflow: 'hidden',
                        flexShrink: 0,
                      }}
                      title={b.title}
                    >
                      {cover ? (
                        <img
                          src={cover}
                          alt={b.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <div style={{ fontSize: 13, color: FOREST_DEEP, lineHeight: 1.35 }}>
                {headline}
              </div>

              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  fontSize: 12,
                  color: '#666',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {previewBooks.map((b) => (
                  <li key={b.id} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.title} <span style={{ color: '#999' }}>· £{Number(b.asking_price_gbp).toFixed(2)}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleAdd(s)}
                style={{
                  background: FOREST,
                  color: '#FAF8F5',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 500,
                  padding: '9px 0',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Add {previewBooks.length === 1 ? 'book' : 'all'} to basket
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
