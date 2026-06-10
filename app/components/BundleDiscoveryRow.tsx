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

const FOREST = '#2D4A3E'
const FOREST_DEEP = '#1F3329'
const GOLD = '#C9A961'

export interface DiscoveryBundleMember {
  id: number
  title: string
  cover_url: string | null
}

export interface DiscoveryBundle {
  id: number
  name: string
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
        background: '#FFFDF6',
        borderBottom: `1px solid ${GOLD}`,
        padding: '20px 0',
      }}
    >
      <div style={{ maxWidth: 840, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: FOREST_DEEP, margin: 0 }}>
            <span aria-hidden style={{ marginRight: 6 }}>📚</span>
            Bundles to explore
          </h2>
          <Link href="/bundles" style={{ fontSize: 12, color: FOREST, textDecoration: 'none', fontWeight: 600 }}>
            See all →
          </Link>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            paddingBottom: 6,
            scrollbarWidth: 'thin',
          }}
        >
          {bundles.map((b) => (
            <Link
              key={b.id}
              href={`/${b.sellerUsername}`}
              style={{
                flexShrink: 0,
                width: 240,
                background: '#fff',
                border: `1px solid ${GOLD}`,
                borderRadius: 10,
                padding: 12,
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', gap: 4 }}>
                {b.members.slice(0, 4).map((m) => (
                  <div
                    key={m.id}
                    title={m.title}
                    style={{
                      width: 40,
                      height: 60,
                      background: FOREST,
                      borderRadius: 3,
                      overflow: 'hidden',
                      flexShrink: 0,
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
                  <div
                    style={{
                      width: 40,
                      height: 60,
                      borderRadius: 3,
                      border: `1px dashed ${GOLD}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#999',
                      fontSize: 11,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    +{b.members.length - 4}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 14, fontWeight: 600, color: FOREST_DEEP, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.name}
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: FOREST_DEEP }}>
                  £{b.bundlePriceGbp.toFixed(2)}
                </span>
                {b.savingsGbp > 0 && (
                  <>
                    <span style={{ fontSize: 12, color: '#999', textDecoration: 'line-through' }}>
                      £{b.subtotalGbp.toFixed(2)}
                    </span>
                    <span style={{ fontSize: 12, color: FOREST, fontWeight: 600 }}>
                      Save £{b.savingsGbp.toFixed(2)}
                    </span>
                  </>
                )}
              </div>

              <div style={{ fontSize: 12, color: '#666' }}>
                from @{b.sellerUsername}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
