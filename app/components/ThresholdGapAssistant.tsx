'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useBasket, useBasketShipping } from './BasketProvider'
import {
  buildSuggestions,
  Candidate,
  Suggestion,
  BasketItem,
  subtotalGbp,
} from '@/app/lib/basket'
import {
  trackBasketSuggestionShown,
  trackBasketSuggestionClicked,
} from '@/app/lib/basketAnalytics'
import { resolveBookCover } from '@/app/lib/coverUrl'

const FOREST = 'var(--color-ground)'
const FOREST_DEEP = 'var(--color-ground-deep)'
const GOLD = 'var(--color-accent)'

type Listing = {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  format?: 'paperback' | 'hardback' | null
  books: { cover_url: string | null; cover_url_hosted?: string | null; category?: string | null } | null
  listing_images?: Array<{ url: string; sort_order: number }> | null
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

  // Fire basket_suggestion_shown once per meaningful change of the offer set —
  // not on every render. Guarded by a ref so the debounced suggestion array
  // doesn't double-emit.
  const lastShownKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!basket || state.kind !== 'below' || suggestions.length === 0) return
    const key = `${suggestions.length}|${Math.round(state.gapGbp * 100)}|${suggestions
      .map((s) => s.items.map((c) => c.listingId).sort((a, b) => a - b).join('-'))
      .join('::')}`
    if (lastShownKeyRef.current === key) return
    lastShownKeyRef.current = key
    trackBasketSuggestionShown({
      placement: 'shelf_top',
      seller,
      gapGbp: state.gapGbp,
      numSuggestions: suggestions.length,
      basketTotalGbp: subtotalGbp(basket.items),
    })
  }, [basket, state, suggestions, seller])

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
        coverUrl: resolveBookCover(l.books, l.listing_images),
        category: l.books?.category ?? null,
      })
    }
    const itemsBefore = basket.items
    const itemsAfter = [...itemsBefore, ...items.filter((it) => !itemsBefore.some((b) => b.listingId === it.listingId))]
    trackBasketSuggestionClicked({
      placement: 'shelf_top',
      seller,
      numBooks: items.length,
      suggestionTotalGbp: suggestion.totalGbp,
      itemsBefore,
      itemsAfter,
    })
    addItems(seller, items, 'suggestion')
  }

  return (
    <section
      aria-label="Get to free shipping"
      style={{
        marginBottom: 24,
        padding: '14px 16px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-paper-warm)',
        border: `1px solid ${GOLD}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
        <h2 className="sy-h3" style={{ margin: 0 }}>
          Get to free shipping
        </h2>
        <span className="sy-mark" style={{ color: 'var(--color-ink-faint)' }}>
          £{state.gapGbp.toFixed(2)} to go
        </span>
      </div>
      <p className="sy-prose" style={{ margin: '10px 0 18px', maxWidth: 620 }}>
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
                background: 'var(--color-sheet)',
                border: `1px solid ${GOLD}`,
                borderRadius: 'var(--radius-md)',
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                {previewBooks.map((b) => {
                  const cover = resolveBookCover(b.books, b.listing_images)
                  return (
                    <div
                      key={b.id}
                      style={{
                        width: 52,
                        height: 66,
                        background: 'var(--color-ground-raised)',
                        borderRadius: 'var(--radius-sm)',
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

              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', lineHeight: 1.32 }}>
                {headline}
              </div>

              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  fontSize: 12,
                  color: 'var(--color-ink-soft)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {previewBooks.map((b) => (
                  <li key={b.id} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {b.title} <span style={{ color: 'var(--color-ink-faint)' }}>· £{Number(b.asking_price_gbp).toFixed(2)}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleAdd(s)}
                style={{
                  background: 'var(--color-action)',
                  color: '#fff',
                  border: '1px solid var(--color-action)',
                  fontSize: 14,
                  fontWeight: 600,
                  padding: '11px 0',
                  borderRadius: 999,
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
