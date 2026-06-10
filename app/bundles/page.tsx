/**
 * /bundles — marketplace-wide bundle browse (slice L13d).
 *
 * Dedicated SEO surface listing every active bundle on the
 * marketplace. Lighter-touch than a full filter/sort/search UX:
 *
 *   - Server-rendered grid of cards (same card style as the BundlesRow
 *     used on seller shelves, just rendered in a 2-column grid).
 *   - Each card links to the seller's shelf where the buyer can add
 *     to basket via the seller-scoped BundlesRow (which has the
 *     BasketProvider context). Keeps this page presentational and
 *     server-only.
 *   - Pagination via ?page=N (50 per page).
 *
 * Linked from SiteNav so visitors can navigate to it directly.
 */

import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import { computeBundlePricing } from '@/app/lib/bundlePricing'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

const FOREST = '#2D4A3E'
const FOREST_DEEP = '#1F3329'
const GOLD = '#C9A961'
const PAGE_SIZE = 50

export async function generateMetadata() {
  return {
    title: 'Browse Bundles — Sell Your Shelf',
    description:
      'Browse curated book bundles from independent sellers on Sell Your Shelf. One shipment, one discount, hand-picked sets.',
    openGraph: {
      title: 'Browse Bundles — Sell Your Shelf',
      description:
        'Curated book bundles — one shipment, one discount, hand-picked by independent sellers.',
      url: 'https://sellyourshelf.com/bundles',
    },
    twitter: { card: 'summary_large_image' },
  }
}

interface BundleCardData {
  id: number
  name: string
  description: string | null
  sellerUsername: string
  members: Array<{ id: number; title: string; cover_url: string | null }>
  bundlePriceGbp: number
  subtotalGbp: number
  savingsGbp: number
}

type SearchParams = Promise<{ page?: string }>

export default async function BundlesIndexPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const params = searchParams ? await searchParams : {}
  const pageNum = Math.max(1, Number(params.page ?? 1) || 1)
  const from = (pageNum - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Fetch the page of active bundles. We join the seller (drop
  // deleted users) and the bundle_items + member listings + covers
  // in one go. Pricing is computed AFTER a follow-up batched query
  // for asking_price_gbp (the inner select doesn't pull it to keep
  // the projection small).
  const { data: bRows, count } = await supabase
    .from('bundles')
    .select(
      `
      id,
      name,
      description,
      pricing_mode,
      discount_pct,
      price_gbp,
      seller:users!inner ( username, deleted_at ),
      bundle_items (
        listing_id,
        sort_order,
        listing:listings!inner (
          id, title, status,
          books ( cover_url, cover_url_hosted )
        )
      )
      `,
      { count: 'exact' },
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(from, to)

  type RawListing = {
    id: number
    title: string
    status: string
    books: { cover_url: string | null; cover_url_hosted: string | null } | null
  }
  type RawSeller = { username: string; deleted_at: string | null }
  type RawBundle = {
    id: number
    name: string
    description: string | null
    pricing_mode: 'discount' | 'absolute'
    discount_pct: number | null
    price_gbp: number | null
    seller: RawSeller | RawSeller[] | null
    bundle_items: Array<{
      listing_id: number
      sort_order: number
      listing: RawListing | RawListing[] | null
    }>
  }

  const raws = (bRows ?? []) as unknown as RawBundle[]
  const draft: BundleCardData[] = []
  for (const raw of raws) {
    const seller = Array.isArray(raw.seller) ? raw.seller[0] : raw.seller
    if (!seller || seller.deleted_at) continue
    const sortedItems = [...raw.bundle_items].sort((a, b) => a.sort_order - b.sort_order)
    let stale = false
    const members: BundleCardData['members'] = []
    for (const it of sortedItems) {
      const l = Array.isArray(it.listing) ? it.listing[0] : it.listing
      if (!l || l.status !== 'active') { stale = true; break }
      const cover = l.books?.cover_url_hosted || l.books?.cover_url || null
      members.push({ id: l.id, title: l.title, cover_url: cover })
    }
    if (stale || members.length < 2) continue
    draft.push({
      id: raw.id,
      name: raw.name,
      description: raw.description,
      sellerUsername: seller.username,
      members,
      bundlePriceGbp: 0,
      subtotalGbp: 0,
      savingsGbp: 0,
    })
  }

  // Enrich with pricing via a second batched query.
  if (draft.length > 0) {
    const allMemberIds = Array.from(
      new Set(draft.flatMap((d) => d.members.map((m) => m.id))),
    )
    const { data: priceRows } = await supabase
      .from('listings')
      .select('id, asking_price_gbp')
      .in('id', allMemberIds)
    const priceById = new Map<number, number>()
    for (const row of (priceRows ?? []) as Array<{ id: number; asking_price_gbp: number }>) {
      priceById.set(row.id, Number(row.asking_price_gbp))
    }
    const rawById = new Map(raws.map((r) => [r.id, r]))
    for (const d of draft) {
      const raw = rawById.get(d.id)
      if (!raw) continue
      const inputs = d.members
        .map((m) => ({ listingId: m.id, askingPriceGbp: priceById.get(m.id) ?? 0 }))
        .filter((m) => m.askingPriceGbp > 0)
      if (inputs.length < 2) continue
      try {
        const pricing = computeBundlePricing({
          listings: inputs,
          pricingMode: raw.pricing_mode,
          discountPct: raw.discount_pct ?? undefined,
          priceGbp: raw.price_gbp != null ? Number(raw.price_gbp) : undefined,
        })
        d.bundlePriceGbp = pricing.bundlePriceGbp
        d.subtotalGbp = pricing.subtotalGbp
        d.savingsGbp = pricing.totalDiscountGbp
      } catch {
        /* keep card without pricing */
      }
    }
  }

  const bundles = draft.filter((d) => d.bundlePriceGbp > 0)
  const totalCount = count ?? bundles.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <SiteNav current="bundles" />

      <div style={{ borderBottom: '0.5px solid #E5E3DF', padding: '32px 24px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link href="/" style={{ color: '#999', textDecoration: 'none' }}>Home</Link>
            <span style={{ color: '#ccc' }}>/</span>
            <span style={{ color: '#666' }}>Bundles</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>
            <span aria-hidden style={{ marginRight: 8 }}>📚</span>Bundles
          </div>
          <div style={{ fontSize: 14, color: '#666', maxWidth: 540 }}>
            Curated by independent sellers — one shipment, one discount. Tap any bundle to see the
            seller&apos;s shelf and add the whole set to your basket.
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
        {bundles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: '#666' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }} aria-hidden>📚</div>
            <div style={{ fontSize: 16, color: '#1A1A1A', fontWeight: 500, marginBottom: 4 }}>
              No bundles yet
            </div>
            <div style={{ fontSize: 14 }}>
              Check back soon — sellers are adding new bundles all the time.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 14,
            }}
          >
            {bundles.map((b) => (
              <Link
                key={b.id}
                href={`/bundle/${b.id}`}
                style={{
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
                        width: 44,
                        height: 66,
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
                        width: 44,
                        height: 66,
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

                <div style={{ fontSize: 14, fontWeight: 600, color: FOREST_DEEP, lineHeight: 1.3 }}>
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

                {b.description && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#666',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }}
                  >
                    {b.description}
                  </div>
                )}

                <div style={{ fontSize: 12, color: '#666' }}>
                  from @{b.sellerUsername}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', fontSize: 13 }}>
            {pageNum > 1 ? (
              <Link href={`/bundles?page=${pageNum - 1}`} style={{ color: FOREST, textDecoration: 'none', fontWeight: 600 }}>
                ← Newer
              </Link>
            ) : (
              <span style={{ color: '#ccc' }}>← Newer</span>
            )}
            <span style={{ color: '#666' }}>
              Page {pageNum} of {totalPages}
            </span>
            {pageNum < totalPages ? (
              <Link href={`/bundles?page=${pageNum + 1}`} style={{ color: FOREST, textDecoration: 'none', fontWeight: 600 }}>
                Older →
              </Link>
            ) : (
              <span style={{ color: '#ccc' }}>Older →</span>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
