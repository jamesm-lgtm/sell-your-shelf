'use client'

/**
 * BundlesRow
 *
 * Buyer-facing surface for slice 8. Renders above the shelf grid on the
 * seller's shelf page (and above the ThresholdGapAssistant) any active
 * bundles the seller has published. Tap "Add bundle" → all member
 * listings flow into the basket, each tagged with this bundle's id so
 * the checkout discount-allocation path (slice 6) applies the discount.
 *
 * Server-rendered hand-off: the parent page (app/[username]/page.tsx)
 * passes pre-fetched bundles + a name→listing lookup so we render
 * synchronously on first paint, no spinner. The "Save £X" preview is
 * computed client-side via app/lib/bundlePricing.ts — same algorithm
 * the server applies at checkout, so the buyer's preview agrees with
 * the actual charge.
 *
 * Cross-seller invariant: bundles are seller-scoped so adding a bundle
 * never crosses sellers — basket dedupe by listingId handles re-adds.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { useBasket } from './BasketProvider'
import { computeBundlePricing, type PricingMode } from '@/app/lib/bundlePricing'
import { resolveBookCover } from '@/app/lib/coverUrl'
import type { BasketItem } from '@/app/lib/basket'

const FOREST = 'var(--color-ground)'
const FOREST_DEEP = 'var(--color-ground-deep)'
const GOLD = 'var(--color-accent)'

export interface BundleRowListing {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  format: 'paperback' | 'hardback' | null
  books: { cover_url: string | null; cover_url_hosted?: string | null; category?: string | null } | null
  listing_images?: Array<{ url: string; sort_order: number }> | null
}

export interface BundleRowBundle {
  id: number
  name: string
  description: string | null
  pricing_mode: PricingMode
  discount_pct: number | null
  price_gbp: number | null
  /** Listings that belong to this bundle — IN ORDER. */
  members: BundleRowListing[]
}

interface Props {
  bundles: BundleRowBundle[]
  seller: { sellerId: string; sellerUsername: string }
}

export default function BundlesRow({ bundles, seller }: Props) {
  const { addItems, basket } = useBasket()

  // Skip if there are no live bundles to show — empty state shouldn't
  // exist (no row at all, per the 2026-06-09 design).
  if (!bundles || bundles.length === 0) return null

  return (
    <section
      aria-label={`Bundles from @${seller.sellerUsername}`}
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
          Bundles from @{seller.sellerUsername}
        </h2>
        <span className="sy-mark" style={{ color: 'var(--color-ink-faint)' }}>
          {bundles.length} {bundles.length === 1 ? 'bundle' : 'bundles'}
        </span>
      </div>
      <p className="sy-prose" style={{ margin: '10px 0 18px', maxWidth: 620 }}>
        Curated by the seller — one shipment, one discount.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {bundles.map((b) => (
          <BundleCard key={b.id} bundle={b} basketHasItem={(id) => !!basket?.items.some((it) => it.listingId === id)} onAdd={() => {
            // Compute effective per-item prices so the basket subtotal
            // matches what the server will actually charge at checkout.
            // (Pre-fix bug: priceGbp was the asking price, so basket
            // showed pre-discount totals while checkout charged the
            // discounted amount — buyer saw two different numbers.)
            const pricing = computeBundlePricing({
              listings: b.members.map((m) => ({
                listingId: m.id,
                askingPriceGbp: Number(m.asking_price_gbp),
              })),
              pricingMode: b.pricing_mode,
              discountPct: b.discount_pct ?? undefined,
              priceGbp: b.price_gbp != null ? Number(b.price_gbp) : undefined,
            })
            const effectiveByListing = new Map(
              pricing.lines.map((l) => [l.listingId, l]),
            )
            const items: BasketItem[] = b.members.map((m) => {
              const line = effectiveByListing.get(m.id)
              return {
                listingId: m.id,
                title: m.title,
                author: m.author,
                priceGbp: line ? line.effectivePriceGbp : Number(m.asking_price_gbp),
                format: m.format ?? null,
                coverUrl: resolveBookCover(m.books, m.listing_images),
                category: m.books?.category ?? null,
                // The signal that makes checkout apply the discount. Server
                // revalidates membership + bundle status; if invalid the
                // items charge at full price (silent drop, by design).
                bundleId: b.id,
                originalPriceGbp: line ? line.originalPriceGbp : Number(m.asking_price_gbp),
                bundleDiscountGbp: line ? line.discountGbp : 0,
                // Total bundle size — the basket compares this against
                // the count of in-basket items with this bundleId to
                // detect if the buyer has broken the bundle by removing
                // a peer. If broken, basket reverts to original prices.
                bundleTotalMembers: b.members.length,
              }
            })
            addItems(seller, items, 'bundle')
          }} />
        ))}
      </div>
    </section>
  )
}

interface BundleCardProps {
  bundle: BundleRowBundle
  basketHasItem: (id: number) => boolean
  onAdd: () => void
}

function BundleCard({ bundle, basketHasItem, onAdd }: BundleCardProps) {
  const pricing = useMemo(() => {
    try {
      return computeBundlePricing({
        listings: bundle.members.map((m) => ({
          listingId: m.id,
          askingPriceGbp: Number(m.asking_price_gbp),
        })),
        pricingMode: bundle.pricing_mode,
        discountPct: bundle.discount_pct ?? undefined,
        priceGbp: bundle.price_gbp != null ? Number(bundle.price_gbp) : undefined,
      })
    } catch {
      return null
    }
  }, [bundle])

  // If every member is already in the basket, this Add is a no-op — show
  // a subdued state so the buyer doesn't tap an inert button.
  const allInBasket = bundle.members.every((m) => basketHasItem(m.id))

  return (
    <div
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
        {bundle.members.slice(0, 5).map((m) => {
          const cover = resolveBookCover(m.books, m.listing_images)
          return (
            <div
              key={m.id}
              title={m.title}
              style={{
                width: 52,
                height: 66,
                background: 'var(--color-ground-raised)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {cover ? (
                <img
                  src={cover}
                  alt={m.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : null}
            </div>
          )
        })}
        {bundle.members.length > 5 && (
          <div
            style={{
              width: 52,
              height: 66,
              borderRadius: 'var(--radius-sm)',
              border: `1px dashed ${GOLD}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-ink-faint)',
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            +{bundle.members.length - 5}
          </div>
        )}
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', lineHeight: 1.32 }}>
        {bundle.name}
      </div>

      {pricing && (
        <div style={{ fontSize: 13, color: 'var(--color-ink-soft)', display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontWeight: 600, color: FOREST_DEEP }}>
            £{pricing.bundlePriceGbp.toFixed(2)}
          </span>
          {pricing.totalDiscountGbp > 0 && (
            <>
              <span style={{ color: 'var(--color-ink-faint)', textDecoration: 'line-through', fontSize: 12 }}>
                £{pricing.subtotalGbp.toFixed(2)}
              </span>
              <span style={{ color: FOREST, fontWeight: 600 }}>
                Save £{pricing.totalDiscountGbp.toFixed(2)}
              </span>
            </>
          )}
        </div>
      )}

      {bundle.description && (
        <p style={{ fontSize: 12, color: 'var(--color-ink-soft)', margin: 0, lineHeight: 1.4 }}>
          {bundle.description}
        </p>
      )}

      <button
        onClick={onAdd}
        disabled={allInBasket}
        style={{
          // Settled state recedes; the live action is brass, like every
          // other primary action on the site.
          background: allInBasket ? 'var(--color-paper-warm)' : 'var(--color-action)',
          color: allInBasket ? 'var(--color-ink)' : '#fff',
          border: allInBasket ? '1px solid var(--color-ink-faint)' : '1px solid var(--color-action)',
          fontSize: 14,
          fontWeight: allInBasket ? 500 : 600,
          padding: '11px 0',
          borderRadius: 999,
          cursor: allInBasket ? 'default' : 'pointer',
        }}
      >
        {allInBasket
          ? 'In basket'
          : `Add ${bundle.members.length} ${bundle.members.length === 1 ? 'book' : 'books'} to basket`}
      </button>
      {/* Secondary action — go to the dedicated bundle page for the
          full description + per-listing detail. Renders as a plain
          link so the Add button stays the primary CTA. */}
      <Link
        href={`/bundle/${bundle.id}`}
        style={{
          textAlign: 'center',
          fontSize: 12,
          color: FOREST,
          fontWeight: 600,
          textDecoration: 'none',
          padding: '4px 0',
        }}
      >
        View bundle details →
      </Link>
    </div>
  )
}
