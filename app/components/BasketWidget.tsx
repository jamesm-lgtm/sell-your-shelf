'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useBasket, useBasketShipping } from './BasketProvider'
import { useShelfInventory, ShelfListing } from './ShelfInventoryProvider'
import { resolveBookCover } from '@/app/lib/coverUrl'
import {
  UNLOCK_FLASH_FLAG,
  buildSuggestions,
  Candidate,
  Suggestion,
  BasketItem,
  subtotalGbp,
} from '@/app/lib/basket'
import {
  trackBasketSuggestionShown,
  trackBasketSuggestionClicked,
  trackCrossSellerModalAction,
} from '@/app/lib/basketAnalytics'

const FOREST = 'var(--color-ground)'
const FOREST_DEEP = 'var(--color-ground-deep)'
const CREAM = 'var(--color-paper)'
const GOLD = 'var(--color-accent)'

export default function BasketWidget() {
  const { basket, itemCount } = useBasket()
  const { state, subtotal } = useBasketShipping()
  const pathname = usePathname() ?? ''

  const [flash, setFlash] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const prevUnlockedRef = useRef(false)

  // Trigger the celebratory flash the FIRST time the user flips from below→unlocked in a session.
  useEffect(() => {
    const isUnlocked = state.kind === 'unlocked'
    const wasUnlocked = prevUnlockedRef.current
    prevUnlockedRef.current = isUnlocked
    if (!isUnlocked || wasUnlocked) return
    if (typeof window === 'undefined') return
    try {
      const alreadyFlashed = window.sessionStorage.getItem(UNLOCK_FLASH_FLAG)
      if (alreadyFlashed) return
      window.sessionStorage.setItem(UNLOCK_FLASH_FLAG, '1')
    } catch {
      // sessionStorage disabled — still allow one flash per mount, no harm.
    }
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 1400)
    return () => clearTimeout(t)
  }, [state.kind])

  if (!basket || state.kind === 'empty') return null

  // Nothing to float on the pages that already *are* the basket: offering
  // "View basket" on /basket is noise, and on /checkout it covers the
  // footer while competing with the only action that matters there.
  // ...and nothing to float over the internal tooling either.
  if (pathname === '/basket' || pathname.startsWith('/checkout') || pathname.startsWith('/admin')) return null

  return (
    <>
      <style>{flashKeyframes}</style>
      <div data-sys-basket-widget style={containerStyle}>
        <div style={cardStyle(flash)}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: CREAM, lineHeight: 1.2 }}>
                {itemCount} {itemCount === 1 ? 'book' : 'books'}
              </div>
              <div
                title={`@${basket.sellerUsername}`}
                style={{
                  fontSize: 12,
                  color: 'rgba(250,248,245,0.65)',
                  marginTop: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                @{basket.sellerUsername}
              </div>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: CREAM, flexShrink: 0 }}>
              £{subtotal.toFixed(2)}
            </span>
          </div>

          {/* Progress / message */}
          {state.kind === 'below' && (
            <>
              <ProgressBar pct={state.progressPct} />
              <div style={messageBelowStyle}>
                Add <strong style={{ color: GOLD }}>£{state.gapGbp.toFixed(2)}</strong> for free shipping
              </div>
            </>
          )}

          {state.kind === 'unlocked' && (
            <>
              <ProgressBar pct={100} unlocked />
              <div style={messageUnlockedStyle}>
                <span aria-hidden style={{ marginRight: 6 }}>✓</span>
                Free shipping unlocked
              </div>
            </>
          )}

          {state.kind === 'oversize' && (
            <div style={messageOversizeStyle}>
              Approaching 5kg limit ({(state.weightG / 1000).toFixed(1)}kg)
            </div>
          )}

          {state.kind === 'exceeded' && (
            <div style={messageExceededStyle}>
              Over 10kg limit — remove items to continue
            </div>
          )}

          {/* Suggestions expander — only when below threshold on the basket's seller's shelf */}
          {state.kind === 'below' && basket && (
            <SuggestionsExpander
              basketSellerId={basket.sellerId}
              basketItemIds={new Set(basket.items.map((it) => it.listingId))}
              basketCategories={
                new Set(
                  basket.items.map((it) => it.category).filter((c): c is string => !!c),
                )
              }
              gapGbp={state.gapGbp}
              isOpen={suggestionsOpen}
              setIsOpen={setSuggestionsOpen}
            />
          )}

          {/* CTA */}
          <Link
            href="/basket"
            style={ctaStyle(state.kind === 'unlocked')}
          >
            {state.kind === 'unlocked' ? 'Checkout' : 'View basket'}
          </Link>
        </div>
      </div>

      <CrossSellerModal />
    </>
  )
}

// ---------- Suggestions expander ----------

function SuggestionsExpander({
  basketSellerId,
  basketItemIds,
  basketCategories,
  gapGbp,
  isOpen,
  setIsOpen,
}: {
  basketSellerId: string
  basketItemIds: Set<number>
  basketCategories: Set<string>
  gapGbp: number
  isOpen: boolean
  setIsOpen: (v: boolean) => void
}) {
  const shelf = useShelfInventory()
  const { basket, addItems } = useBasket()

  // Only offer suggestions when the user is browsing the same seller's shelf the
  // basket belongs to — otherwise we can't add to this basket anyway.
  const enabled = !!shelf && shelf.seller.sellerId === basketSellerId

  const suggestions: Suggestion[] = useMemo(() => {
    if (!enabled || !shelf) return []
    const candidates: Candidate[] = shelf.listings
      .filter((l) => !basketItemIds.has(l.id))
      .map((l) => ({
        listingId: l.id,
        priceGbp: Number(l.asking_price_gbp),
        category: l.books?.category ?? null,
      }))
    return buildSuggestions({
      candidates,
      gapGbp,
      basketCategories,
      maxSuggestions: 3,
    })
  }, [enabled, shelf, basketItemIds, basketCategories, gapGbp])

  // Fire basket_suggestion_shown once per meaningful change of the offer set.
  const lastShownKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!enabled || !shelf || suggestions.length === 0 || !basket) return
    const key = `${suggestions.length}|${Math.round(gapGbp * 100)}|${suggestions
      .map((s) => s.items.map((c) => c.listingId).sort((a, b) => a - b).join('-'))
      .join('::')}`
    if (lastShownKeyRef.current === key) return
    lastShownKeyRef.current = key
    trackBasketSuggestionShown({
      placement: 'widget_expander',
      seller: shelf.seller,
      gapGbp,
      numSuggestions: suggestions.length,
      basketTotalGbp: subtotalGbp(basket.items),
    })
  }, [enabled, shelf, suggestions, gapGbp, basket])

  if (!enabled || suggestions.length === 0) return null

  const shelfById = new Map<number, ShelfListing>((shelf?.listings ?? []).map((l) => [l.id, l]))

  const handleAdd = (s: Suggestion) => {
    if (!shelf || !basket) return
    const items: BasketItem[] = []
    for (const c of s.items) {
      const l = shelfById.get(c.listingId)
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
      placement: 'widget_expander',
      seller: shelf.seller,
      numBooks: items.length,
      suggestionTotalGbp: s.totalGbp,
      itemsBefore,
      itemsAfter,
    })
    addItems(shelf.seller, items, 'suggestion')
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'rgba(192,138,62,0.10)',
          color: GOLD,
          border: `1px solid rgba(192,138,62,0.35)`,
          borderRadius: 999,
          padding: '8px 12px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <span>Get to free shipping</span>
        <span aria-hidden style={{ fontSize: 14, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
          ⌄
        </span>
      </button>

      {isOpen && (
        <ul
          style={{
            listStyle: 'none',
            margin: '8px 0 0',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s, idx) => {
            const previewBooks = s.items
              .map((c) => shelfById.get(c.listingId))
              .filter(Boolean) as ShelfListing[]
            const label =
              previewBooks.length === 1
                ? previewBooks[0].title
                : `${previewBooks.length} books`
            return (
              <li key={idx}>
                <button
                  onClick={() => handleAdd(s)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    background: 'rgba(250,248,245,0.06)',
                    border: '1px solid rgba(250,248,245,0.12)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {previewBooks.slice(0, 3).map((b) => {
                      const cover = resolveBookCover(b.books, b.listing_images)
                      return (
                        <div
                          key={b.id}
                          style={{
                            width: 26,
                            height: 38,
                            background: FOREST,
                            borderRadius: 2,
                            overflow: 'hidden',
                            border: '1px solid rgba(0,0,0,0.3)',
                          }}
                        >
                          {cover ? (
                            <img
                              src={cover}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: CREAM,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(250,248,245,0.65)' }}>
                      + £{s.totalGbp.toFixed(2)}
                    </div>
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11,
                      fontWeight: 600,
                      color: GOLD,
                      border: `1px solid ${GOLD}`,
                      borderRadius: 999,
                      padding: '3px 8px',
                    }}
                  >
                    Add
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ProgressBar({ pct, unlocked = false }: { pct: number; unlocked?: boolean }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${Math.round(pct)}% to free shipping`}
      style={{
        height: 6,
        borderRadius: 999,
        background: 'rgba(250,248,245,0.18)',
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          height: '100%',
          // scaleX rather than width: width animation relayouts every frame,
          // transform is composited. transformOrigin keeps it growing left→right.
          width: '100%',
          transform: `scaleX(${Math.max(0, Math.min(100, pct)) / 100})`,
          transformOrigin: 'left center',
          background: unlocked ? GOLD : `linear-gradient(90deg, ${GOLD} 0%, var(--color-notice-line) 100%)`,
          transition: 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: unlocked ? '0 0 12px rgba(192,138,62,0.55)' : 'none',
        }}
      />
    </div>
  )
}

// ---------- Cross-seller modal ----------

function CrossSellerModal() {
  const { conflict, dismissConflict, clearBasket } = useBasket()

  if (!conflict) return null

  const { attempt, currentSeller } = conflict
  const currentCount = (() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem('sys:basket:v1')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed?.items?.length ?? null
    } catch {
      return null
    }
  })()

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31,51,41,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={() => {
        trackCrossSellerModalAction({
          action: 'cancel',
          currentSellerUsername: currentSeller.sellerUsername,
          attemptedSellerUsername: attempt.seller.sellerUsername,
        })
        dismissConflict()
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: CREAM,
          borderRadius: 14,
          padding: '24px 22px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 600, color: FOREST_DEEP, marginBottom: 10 }}>
          One seller at a time
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-ink)', lineHeight: 1.5, margin: 0 }}>
          You have{' '}
          {currentCount !== null ? (
            <strong>{currentCount} {currentCount === 1 ? 'book' : 'books'}</strong>
          ) : (
            <strong>books</strong>
          )}{' '}
          from <strong>@{currentSeller.sellerUsername}</strong> in your basket. To add from{' '}
          <strong>@{attempt.seller.sellerUsername}</strong>, you'll need to checkout your current basket
          or clear it.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
          <Link
            href="/basket"
            onClick={() => {
              trackCrossSellerModalAction({
                action: 'checkout',
                currentSellerUsername: currentSeller.sellerUsername,
                attemptedSellerUsername: attempt.seller.sellerUsername,
              })
              dismissConflict()
            }}
            style={{
              background: 'var(--color-action)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              padding: '13px 20px',
              borderRadius: 999,
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            Checkout @{currentSeller.sellerUsername}'s books
          </Link>
          <button
            onClick={() => {
              trackCrossSellerModalAction({
                action: 'clear',
                currentSellerUsername: currentSeller.sellerUsername,
                attemptedSellerUsername: attempt.seller.sellerUsername,
              })
              clearBasket()
              dismissConflict()
            }}
            style={{
              background: 'transparent',
              color: 'var(--color-ink)',
              fontSize: 15,
              fontWeight: 600,
              padding: '13px 20px',
              borderRadius: 999,
              border: '1px solid var(--color-ink-faint)',
              cursor: 'pointer',
            }}
          >
            Clear basket
          </button>
          <button
            onClick={() => {
              trackCrossSellerModalAction({
                action: 'cancel',
                currentSellerUsername: currentSeller.sellerUsername,
                attemptedSellerUsername: attempt.seller.sellerUsername,
              })
              dismissConflict()
            }}
            style={{
              background: 'transparent',
              color: 'var(--color-ink-soft)',
              fontSize: 14,
              fontWeight: 600,
              padding: '10px 16px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- styles ----------

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 900,
  // Bottom on both: full-width on mobile, right-hand corner on desktop.
  // The desktop half is a media query in the inline <style> below.
  bottom: 16,
  left: 16,
  right: 16,
  pointerEvents: 'none',
}

const cardStyle = (flash: boolean): React.CSSProperties => ({
  pointerEvents: 'auto',
  background: FOREST_DEEP,
  borderRadius: 14,
  padding: '14px 16px 14px 16px',
  boxShadow: flash
    ? '0 0 0 3px rgba(192,138,62,0.55), 0 20px 50px rgba(0,0,0,0.32)'
    : '0 14px 40px rgba(0,0,0,0.25)',
  border: `1px solid rgba(250,248,245,0.08)`,
  maxWidth: 360,
  marginLeft: 'auto',
  animation: flash ? 'sys-basket-pop 700ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
})

const messageBelowStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'rgba(250,248,245,0.85)',
  marginBottom: 12,
}

const messageUnlockedStyle: React.CSSProperties = {
  fontSize: 13,
  // Paper, not brass. Brass is the action colour, and this sits directly
  // above a brass Checkout button — in brass the panel reads as one flat
  // block with no hierarchy between state and action.
  color: 'var(--color-on-ground)',
  fontWeight: 600,
  marginBottom: 12,
}

const messageOversizeStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'rgba(250,248,245,0.85)',
  marginBottom: 12,
}

const messageExceededStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#FCA5A5',
  fontWeight: 600,
  marginBottom: 12,
}

// Paper on green: 12.57:1 for the label and 12.57:1 against the panel.
// Light brass measured 4.44:1 for its text — under AA — and white on it
// was 3.02:1, so neither brass option was usable here.
const ctaStyle = (_unlocked: boolean): React.CSSProperties => ({
  display: 'block',
  textAlign: 'center',
  background: 'var(--color-paper)',
  color: 'var(--color-ground-deep)',
  fontSize: 14,
  fontWeight: 600,
  padding: '10px 0',
  borderRadius: 8,
  textDecoration: 'none',
})

const flashKeyframes = `
@keyframes sys-basket-pop {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.04); }
  70%  { transform: scale(0.995); }
  100% { transform: scale(1); }
}
/* This <style> mounts only while the widget is on screen, so the space it
   reserves exists exactly when something is there to occupy it. Without it
   the panel sits over the last rows of the footer once you reach the
   bottom of the page. The footer sets its padding inline, so this has to
   outrank it. */
footer { padding-bottom: 200px !important; }
@media (min-width: 720px) {
  footer { padding-bottom: 150px !important; }
  [data-sys-basket-widget] {
    /* Bottom-right, the same corner it holds on mobile. It was top-right
       (and before that top:16, which covered the nav) — but a fixed panel
       under the nav covers the top of every page: breadcrumbs, the shelf
       name, and the share action that sits at the right of that row.
       Bottom-right is the corner nothing else wants, so the panel can stay
       up permanently without hiding anything. */
    top: auto !important;
    bottom: 16px !important;
    left: auto !important;
    right: 16px !important;
  }
}
`
