'use client'

/**
 * ListingBundleStrip
 *
 * Slice 9 (website). Inline strip on a listing detail page advertising
 * any active bundles this listing belongs to. Tap "Add bundle to basket"
 * → all member listings flow into the basket tagged with this bundle's
 * id; checkout discount applies as normal.
 *
 * If a listing belongs to multiple active bundles (rare — same listing
 * in two bundles by the seller) we render one strip per bundle. They
 * stack; usually there's just one.
 *
 * Server passes pre-resolved bundles (members + pricing already
 * computed at parse time) so this client island just renders + handles
 * the basket call.
 */

import { useBasket } from './BasketProvider'
import { resolveBookCover } from '@/app/lib/coverUrl'
import type { BasketItem } from '@/app/lib/basket'

const FOREST = '#2D4A3E'
const FOREST_DEEP = '#1F3329'
const GOLD = '#C9A961'

export interface BundleStripMember {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  format: 'paperback' | 'hardback' | null
  books: { cover_url: string | null; cover_url_hosted?: string | null; category?: string | null } | null
  listing_images?: Array<{ url: string; sort_order: number }> | null
}

export interface BundleStripBundle {
  id: number
  name: string
  /** Seller-written or AI-derived pitch; rendered below the metadata. */
  description?: string | null
  members: BundleStripMember[]
  bundlePriceGbp: number
  totalDiscountGbp: number
  /**
   * Per-listing pricing breakdown — server-computed via
   * computeBundlePricing so the basket gets the correct effective
   * price + originalPrice + discount populated when the buyer taps Add.
   * Map keyed by listing_id.
   */
  lines: Record<number, {
    effectivePriceGbp: number
    originalPriceGbp: number
    discountGbp: number
  }>
}

interface Props {
  bundles: BundleStripBundle[]
  seller: { sellerId: string; sellerUsername: string }
  /** The current listing — used to label the strip ("alongside this book"). */
  currentListingId: number
}

export default function ListingBundleStrip({ bundles, seller, currentListingId }: Props) {
  const { addItems, basket } = useBasket()

  if (!bundles || bundles.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
      {bundles.map((b) => {
        const allInBasket = b.members.every((m) =>
          basket?.items.some((it) => it.listingId === m.id),
        )
        const otherCount = b.members.length - 1
        return (
          <div
            key={b.id}
            style={{
              background: '#FFFDF6',
              border: `1px solid ${GOLD}`,
              borderRadius: 10,
              padding: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {b.members.slice(0, 3).map((m) => {
                const cover = resolveBookCover(m.books, m.listing_images)
                return (
                  <div
                    key={m.id}
                    title={m.title}
                    style={{
                      width: 32,
                      height: 48,
                      background: FOREST,
                      borderRadius: 2,
                      overflow: 'hidden',
                      flexShrink: 0,
                      // Highlight the current listing so the buyer can
                      // see this strip is about *this* book + others.
                      outline:
                        m.id === currentListingId
                          ? `2px solid ${GOLD}`
                          : 'none',
                      outlineOffset: 1,
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
              {b.members.length > 3 && (
                <div
                  style={{
                    width: 32,
                    height: 48,
                    borderRadius: 2,
                    border: `1px dashed ${GOLD}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  +{b.members.length - 3}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: FOREST_DEEP, marginBottom: 2 }}>
                Part of {b.name}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {otherCount === 1
                  ? 'Save '
                  : `Buy all ${b.members.length} together — save `}
                <span style={{ color: FOREST, fontWeight: 600 }}>
                  £{b.totalDiscountGbp.toFixed(2)}
                </span>{' '}
                · bundle price{' '}
                <span style={{ fontWeight: 600 }}>£{b.bundlePriceGbp.toFixed(2)}</span>
              </div>
              {b.description ? (
                // Pitch line — typically the AI's reasoning or whatever
                // the seller wrote in the create sheet. Capped at 2
                // lines via webkit-line-clamp so verbose descriptions
                // don't blow out the strip height.
                <div
                  style={{
                    fontSize: 12,
                    color: '#666',
                    fontStyle: 'italic',
                    marginTop: 4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                    overflow: 'hidden',
                  }}
                >
                  {b.description}
                </div>
              ) : null}
            </div>
            <button
              onClick={() => {
                // Effective prices from the server-computed lines so the
                // basket subtotal matches the actual charge at checkout.
                const items: BasketItem[] = b.members.map((m) => {
                  const line = b.lines[m.id]
                  return {
                    listingId: m.id,
                    title: m.title,
                    author: m.author,
                    priceGbp: line?.effectivePriceGbp ?? Number(m.asking_price_gbp),
                    format: m.format ?? null,
                    coverUrl: resolveBookCover(m.books, m.listing_images),
                    category: m.books?.category ?? null,
                    bundleId: b.id,
                    originalPriceGbp: line?.originalPriceGbp ?? Number(m.asking_price_gbp),
                    bundleDiscountGbp: line?.discountGbp ?? 0,
                  }
                })
                addItems(seller, items, 'bundle')
              }}
              disabled={allInBasket}
              style={{
                background: allInBasket ? '#E5E3DF' : FOREST,
                color: allInBasket ? '#999' : '#FAF8F5',
                border: 'none',
                fontSize: 12,
                fontWeight: 500,
                padding: '8px 14px',
                borderRadius: 6,
                cursor: allInBasket ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {allInBasket ? 'In basket' : 'Add bundle'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
