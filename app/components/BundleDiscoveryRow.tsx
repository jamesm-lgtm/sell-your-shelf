'use client'

/**
 * BundleDiscoveryRow
 *
 * Marketplace-wide bundle showcase on /new (the main browse page).
 * Different from BundlesRow (which is per-seller on a shelf page) —
 * this surfaces the freshest active bundles across ALL sellers as a
 * horizontal-scroll row.
 *
 * Each card opens the seller's shelf page where the buyer can add
 * the bundle to basket via the seller-scoped BundlesRow (which has
 * the BasketProvider context). This row stays presentational + link-
 * only so it can render without dragging the basket context onto
 * /new (which is a server component otherwise).
 */

import Link from 'next/link'

const FOREST = 'var(--color-ground)'
const FOREST_DEEP = 'var(--color-ground-deep)'
const GOLD = 'var(--color-accent)'

export interface DiscoveryBundleMember {
  id: number
  title: string
  cover_url: string | null
}

export interface DiscoveryBundle {
  id: number
  name: string
  description: string | null
  sellerUsername: string
  members: DiscoveryBundleMember[]
  bundlePriceGbp: number
  subtotalGbp: number
  savingsGbp: number
}

interface Props {
  bundles: DiscoveryBundle[]
}

export default function BundleDiscoveryRow({ bundles }: Props) {
  if (!bundles || bundles.length === 0) return null

  return (
    <section
      aria-label="Bundles to explore"
      style={{
        background: 'var(--color-paper-warm)',
        padding: '40px 0 14px',
      }}
    >
      <div className="sy-wrap">
        <div className="sy-rail-head">
          <h2 className="sy-h3" style={{ margin: 0 }}>
            Bundles to explore
          </h2>
          <Link href="/bundles" style={{ fontSize: 14, color: 'var(--color-action)', textDecoration: 'none', fontWeight: 600 }}>
            See all →
          </Link>
        </div>
        <p style={{ fontSize: 15, color: 'var(--color-ink-soft)', margin: '10px 0 0', lineHeight: 1.5, maxWidth: 620 }}>
          Several books from one seller, sent as a single parcel. Free delivery on
          all bundles over £10.
        </p>

      </div>
      <div className="sy-rail">
          {bundles.map((b) => (
            <Link
              key={b.id}
              href={`/bundle/${b.id}`}
              className="sy-bundle-card"
              style={{
                flexShrink: 0,
                width: 268,
                background: 'var(--color-sheet)',
                border: '1px solid var(--color-rule)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Covers fanned like a stack of books that ship together,
                  rather than a row of thumbnails with a dashed box on the
                  end. Overlap reads as "these come as one". */}
              <div style={{ display: 'flex', paddingLeft: 6, minHeight: 96 }}>
                {b.members.slice(0, 4).map((m, i) => (
                  <div
                    key={m.id}
                    title={m.title}
                    style={{
                      width: 62,
                      height: 93,
                      background: 'var(--color-ground-raised)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      flexShrink: 0,
                      marginLeft: i === 0 ? 0 : -22,
                      boxShadow: '0 3px 10px rgba(26,29,27,.22)',
                      outline: '2px solid var(--color-sheet)',
                      zIndex: 10 - i,
                      position: 'relative',
                    }}
                  >
                    {m.cover_url ? (
                      <img
                        src={m.cover_url}
                        alt={m.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : null}
                  </div>
                ))}
                {b.members.length > 4 && (
                  <span
                    className="sy-figure"
                    style={{
                      // Not a book-shaped tile. A count isn't a book, and
                      // stacking it in front of the fan inverted the
                      // physical logic — later books sit behind, always.
                      alignSelf: 'center',
                      marginLeft: 14,
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--color-ink-faint)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    +{b.members.length - 4}
                  </span>
                )}
              </div>

              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--color-ink)',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    minHeight: 'calc(15px * 1.35 * 2)',
                  }}
                >
                  {b.name}
                </div>
                <p
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.45,
                    color: 'var(--color-ink-soft)',
                    margin: '6px 0 0',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    minHeight: 'calc(13.5px * 1.45 * 2)',
                  }}
                >
                  {b.description ?? ''}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span className="sy-price">£{b.bundlePriceGbp.toFixed(2)}</span>
                {b.savingsGbp > 0 && (
                  <>
                    <span className="sy-figure" style={{ fontSize: 13, color: 'var(--color-ink-faint)', textDecoration: 'line-through' }}>
                      £{b.subtotalGbp.toFixed(2)}
                    </span>
                    <span className="sy-figure" style={{ fontSize: 13, color: 'var(--color-action)', fontWeight: 600 }}>
                      Save £{b.savingsGbp.toFixed(2)}
                    </span>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>
                <span style={{ fontSize: 13, color: 'var(--color-ink-faint)' }}>
                  {b.members.length} books · @{b.sellerUsername}
                </span>
                <span className="sy-bundle-go" aria-hidden>View →</span>
              </div>
            </Link>
          ))}
      </div>
    </section>
  )
}
