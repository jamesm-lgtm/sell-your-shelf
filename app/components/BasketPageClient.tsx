'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { useBasket, useBasketShipping } from './BasketProvider'
import {
  FREE_SHIPPING_THRESHOLD_GBP,
  SHIPPING_FLAT_GBP,
  bundleCompletenessMap,
  type BasketItem,
} from '@/app/lib/basket'
import {
  trackBasketPageViewed,
  trackCheckoutCtaClicked,
} from '@/app/lib/basketAnalytics'

const FOREST = 'var(--color-ground)'
const FOREST_DEEP = 'var(--color-ground-deep)'
const CREAM = 'var(--color-paper)'
const GOLD = 'var(--color-accent)'

// Browser-safe client (anon key) — only used to check live listing status.
const supabase =
  typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      )
    : null

export default function BasketPageClient() {
  const { basket, removeItem, clearBasket } = useBasket()
  const { state, subtotal, weightG } = useBasketShipping()

  const [staleIds, setStaleIds] = useState<Set<number>>(new Set())
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  // Check which basket items are still active.
  useEffect(() => {
    if (!supabase || !basket || basket.items.length === 0) {
      setStaleIds(new Set())
      return
    }
    let cancelled = false
    ;(async () => {
      const ids = basket.items.map((it) => it.listingId)
      const { data, error } = await supabase
        .from('listings')
        .select('id, status')
        .in('id', ids)
      if (cancelled || error) return
      const activeIds = new Set((data ?? []).filter((r: any) => r.status === 'active').map((r: any) => r.id as number))
      const stale = new Set<number>()
      for (const id of ids) if (!activeIds.has(id)) stale.add(id)
      setStaleIds(stale)
    })()
    return () => {
      cancelled = true
    }
  }, [basket])

  // Fire basket_page_viewed once per visit, after the stale-check has resolved
  // so the stale_items_count is accurate.
  const viewFiredRef = useRef(false)
  useEffect(() => {
    if (viewFiredRef.current) return
    if (!hydrated || !basket || basket.items.length === 0) return
    viewFiredRef.current = true
    trackBasketPageViewed({ basket, staleItemsCount: staleIds.size })
  }, [hydrated, basket, staleIds])

  // Show a quiet hydrate state to avoid SSR/CSR flicker.
  if (!hydrated) {
    return <div style={{ color: 'var(--color-ink-faint)', fontSize: 14, padding: 24 }}>Loading basket…</div>
  }

  if (!basket || basket.items.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, color: FOREST_DEEP, fontWeight: 600, marginBottom: 8 }}>
          Your basket is empty
        </h1>
        <p style={{ color: 'var(--color-ink-soft)', fontSize: 14, marginBottom: 24 }}>
          Browse shelves and add books to get started.
        </p>
        <Link
          href="/browse"
          style={{
            display: 'inline-block',
            background: 'var(--color-action)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            padding: '11px 22px',
            borderRadius: 'var(--radius-pill)',
            textDecoration: 'none',
          }}
        >
          Browse books
        </Link>
      </div>
    )
  }

  const staleCount = staleIds.size
  // Flat £2.50 shipping below £10, free above. Soft warn at 5kg (still flat).
  // Hard cap at 10kg blocks checkout (the button below is disabled in that case).
  const isUnlocked = state.kind === 'unlocked'
  const isExceeded = state.kind === 'exceeded'
  const isOversize = state.kind === 'oversize'
  const shippingLabel = isUnlocked
    ? 'Free'
    : isExceeded
    ? '—'
    : `£${SHIPPING_FLAT_GBP.toFixed(2)}`
  const totalGbp = isUnlocked ? subtotal : isExceeded ? subtotal : subtotal + SHIPPING_FLAT_GBP
  // Bundle-aware aggregates. Only items in still-complete bundles
  // contribute to the visible discount; items whose bundle was broken
  // by removal revert to their original asking price (matches what
  // the server actually charges via the all-members-present gate in
  // create-order-payment-intent).
  const basketItems = basket?.items ?? []
  const completeness = bundleCompletenessMap(basketItems)
  const isItemDiscountActive = (it: BasketItem) =>
    it.bundleId != null && completeness.get(it.bundleId) === true
  const totalBundleDiscount = basketItems.reduce(
    (sum: number, it) =>
      sum + (isItemDiscountActive(it) ? Number(it.bundleDiscountGbp ?? 0) : 0),
    0,
  )
  const preDiscountSubtotal = basketItems.reduce(
    (sum: number, it) => sum + Number(it.originalPriceGbp ?? it.priceGbp),
    0,
  )

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, color: FOREST_DEEP, fontWeight: 600, margin: 0 }}>
          Your basket
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', margin: '4px 0 0' }}>
          From{' '}
          <Link href={`/${basket.sellerUsername}`} style={{ color: FOREST, textDecoration: 'underline' }}>
            @{basket.sellerUsername}
          </Link>
        </p>
      </div>

      {/* Stale banner */}
      {staleCount > 0 && (
        <div
          style={{
            background: 'var(--color-notice-bg)',
            border: '1px solid var(--color-notice-line)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 12px',
            fontSize: 13,
            color: 'var(--color-notice-ink)',
            marginBottom: 16,
          }}
        >
          {staleCount === 1
            ? '1 item is no longer available. Remove it to continue.'
            : `${staleCount} items are no longer available. Remove them to continue.`}
        </div>
      )}

      {/* Items */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {basket.items.map((it) => {
          const stale = staleIds.has(it.listingId)
          return (
            <li
              key={it.listingId}
              style={{
                background: '#fff',
                border: '1px solid var(--color-rule)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                opacity: stale ? 0.7 : 1,
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 75,
                  background: FOREST,
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {it.coverUrl ? (
                  <img src={it.coverUrl} alt={it.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {it.title}
                </div>
                {it.author && (
                  <div style={{ fontSize: 12, color: 'var(--color-ink-faint)' }}>{it.author}</div>
                )}
                {stale ? (
                  <div style={{ fontSize: 12, color: 'var(--color-notice-strong)', marginTop: 4, fontWeight: 500 }}>
                    No longer available
                  </div>
                ) : isItemDiscountActive(it) && Number(it.bundleDiscountGbp ?? 0) > 0 && it.originalPriceGbp != null ? (
                  // Bundle-discounted line: show the effective price in
                  // primary green next to the struck-through original, plus
                  // a small "−£X bundle" caption so the buyer sees exactly
                  // where the discount is coming from per item.
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, color: FOREST, fontWeight: 600 }}>
                        £{Number(it.priceGbp).toFixed(2)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--color-ink-faint)', textDecoration: 'line-through' }}>
                        £{Number(it.originalPriceGbp).toFixed(2)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-ink-faint)', marginTop: 2 }}>
                      −£{Number(it.bundleDiscountGbp).toFixed(2)} bundle
                    </div>
                  </div>
                ) : (
                  // Non-bundle item OR bundle item whose peers are gone —
                  // show the original asking price (falls back to
                  // priceGbp for non-bundle items where they're equal).
                  <div style={{ fontSize: 13, color: FOREST, fontWeight: 600, marginTop: 4 }}>
                    £{Number(it.originalPriceGbp ?? it.priceGbp).toFixed(2)}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeItem(it.listingId, 'basket_page')}
                aria-label={`Remove ${it.title}`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-ink-faint)',
                  fontSize: 13,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </li>
          )
        })}
      </ul>

      {/* Totals */}
      <div
        style={{
          marginTop: 24,
          background: '#fff',
          border: '1px solid var(--color-rule)',
          borderRadius: 'var(--radius-md)',
          padding: 16,
        }}
      >
        {totalBundleDiscount > 0 ? (
          <>
            <Row
              label="Items"
              value={`£${preDiscountSubtotal.toFixed(2)}`}
            />
            <Row
              label="Bundle discount"
              value={`−£${totalBundleDiscount.toFixed(2)}`}
              highlight
            />
            <Row label="Subtotal" value={`£${subtotal.toFixed(2)}`} />
          </>
        ) : (
          <Row label="Subtotal" value={`£${subtotal.toFixed(2)}`} />
        )}
        <Row
          label="Shipping"
          value={shippingLabel}
          hint={
            state.kind === 'oversize'
              ? `Approaching 5kg limit (${(weightG / 1000).toFixed(1)}kg).`
              : state.kind === 'exceeded'
              ? `Over 10kg limit (${(weightG / 1000).toFixed(1)}kg) — remove items to continue.`
              : state.kind === 'below'
              ? `Add £${state.gapGbp.toFixed(2)} to unlock free shipping (orders over £${FREE_SHIPPING_THRESHOLD_GBP}).`
              : state.kind === 'unlocked'
              ? 'Free over £10 — applied.'
              : undefined
          }
          highlight={state.kind === 'unlocked'}
        />
        <div style={{ borderTop: '1px solid var(--color-rule)', marginTop: 12, paddingTop: 12 }}>
          <Row label={<strong>Total</strong>} value={<strong>£{totalGbp.toFixed(2)}</strong>} />
        </div>
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
        {staleCount > 0 || isExceeded ? (
          <button
            disabled
            style={{
              background: 'var(--color-ink-faint)',
              color: CREAM,
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
              padding: '13px 0',
              borderRadius: 'var(--radius-pill)',
              cursor: 'not-allowed',
            }}
          >
            {isExceeded
              ? 'Remove items to get under 10kg'
              : 'Remove unavailable items to continue'}
          </button>
        ) : (
          <Link
            href="/checkout"
            onClick={() => trackCheckoutCtaClicked({ basket })}
            style={{
              background: 'var(--color-action)',
              color: '#fff',
              border: 'none',
              fontSize: 15,
              fontWeight: 600,
              padding: '13px 0',
              borderRadius: 'var(--radius-pill)',
              textAlign: 'center',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Checkout
          </Link>
        )}
        <Link
          href={`/${basket.sellerUsername}`}
          style={{
            background: '#fff',
            color: FOREST,
            border: `1px solid ${FOREST}`,
            fontSize: 14,
            fontWeight: 500,
            padding: '11px 0',
            borderRadius: 'var(--radius-pill)',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          Continue browsing @{basket.sellerUsername}'s shelf
        </Link>
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && window.confirm('Clear all items from your basket?')) {
              clearBasket()
            }
          }}
          style={{
            background: 'transparent',
            color: 'var(--color-ink-faint)',
            border: 'none',
            fontSize: 13,
            padding: '8px 0',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Clear basket
        </button>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: string
  highlight?: boolean
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
        <span style={{ fontSize: 14, color: 'var(--color-ink)' }}>{label}</span>
        <span style={{ fontSize: 14, color: highlight ? GOLD : 'var(--color-ink)', fontWeight: highlight ? 600 : 400 }}>
          {value}
        </span>
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: 'var(--color-ink-faint)', marginTop: 2 }}>{hint}</div>
      )}
    </div>
  )
}
