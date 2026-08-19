import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import ShelfGrid from '@/app/components/ShelfGrid'
import { formatDate } from '@/app/components/ui'
import ShareButton from '@/app/components/ShareButton'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import AppBadges from '@/app/components/AppBadges'
import ShelfVisitTracker from '@/app/components/ShelfVisitTracker'
import ThresholdGapAssistant from '@/app/components/ThresholdGapAssistant'
import BundlesRow, { type BundleRowBundle } from '@/app/components/BundlesRow'
import { RegisterShelfInventory } from '@/app/components/ShelfInventoryProvider'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

type Props = {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params

  const { data: user } = await supabase
    .from('users')
    .select('id, username')
    .eq('username', username)
    .single()

  if (!user) return { title: 'Shelf not found — Sell Your Shelf' }

  const { data: listings } = await supabase
    .from('listings')
    .select('asking_price_gbp, books(cover_url, cover_url_hosted)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('asking_price_gbp', { ascending: true })

  const count = listings?.length ?? 0
  const fromPrice = listings?.[0]?.asking_price_gbp
    ? `£${Number(listings[0].asking_price_gbp).toFixed(2)}`
    : null
  const ogImage = (listings as any)?.find((l: any) => l.books?.cover_url_hosted || l.books?.cover_url)?.books?.cover_url_hosted
    ?? (listings as any)?.find((l: any) => l.books?.cover_url)?.books?.cover_url
    ?? 'https://sellyourshelf.com/og-default.png'

  return {
    title: `@${user.username}'s shelf — Sell Your Shelf`,
    description: fromPrice ? `${count} books for sale from ${fromPrice}` : `${count} books for sale`,
    openGraph: {
      title: `@${user.username}'s shelf on Sell Your Shelf`,
      description: fromPrice ? `${count} books for sale from ${fromPrice} — shop the shelf` : `${count} books for sale`,
      images: [{ url: ogImage }],
      url: `https://sellyourshelf.com/@${user.username}`,
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function SellerShelfPage({ params }: Props) {
  const { username } = await params

  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, location, registered_at, bio, avatar_url')
    .eq('username', username)
    .single()

  if (error || !user || !user.username) return notFound()

  const { data: listings } = await supabase
    .from('listings')
    .select('id, title, author, asking_price_gbp, condition, format, books(cover_url, cover_url_hosted, category), listing_images(url, sort_order)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const safeListings = (listings ?? []) as unknown as Array<{
    id: number
    title: string
    author: string | null
    asking_price_gbp: number
    condition: string
    format: 'paperback' | 'hardback' | null
    books: { cover_url: string | null; cover_url_hosted?: string | null; category?: string | null } | null
    listing_images: Array<{ url: string; sort_order: number }> | null
  }>

  // ---- Bundles (slice 8) ----------------------------------------------
  // Fetch this seller's active bundles + their member listings. RLS allows
  // public select on active bundles, so the unauthenticated supabase
  // client used here can read them. We then hydrate each member with
  // the existing listing data from safeListings (avoids re-fetching).
  // Bundles whose members are no longer all active (e.g. one just sold
  // and the auto-archive trigger hasn't fired yet, or another bundle
  // already consumed it) are filtered out so we don't show inert cards.
  const { data: bundleRows } = await supabase
    .from('bundles')
    .select(`
      id,
      name,
      description,
      pricing_mode,
      discount_pct,
      price_gbp,
      bundle_items ( listing_id, sort_order )
    `)
    .eq('seller_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const listingsById = new Map(safeListings.map((l) => [l.id, l]))
  const rawBundles = (bundleRows ?? []) as Array<{
    id: number
    name: string
    description: string | null
    pricing_mode: 'discount' | 'absolute'
    discount_pct: number | null
    price_gbp: number | null
    bundle_items: Array<{ listing_id: number; sort_order: number }>
  }>

  const bundles: BundleRowBundle[] = []
  // Listings that are in at least one valid bundle — drives the
  // "Bundle" badge on ShelfGrid cards (slice 10).
  const listingIdsInBundles = new Set<number>()
  for (const b of rawBundles) {
    const orderedItems = [...b.bundle_items].sort((a, b) => a.sort_order - b.sort_order)
    const members: BundleRowBundle['members'] = []
    let stale = false
    for (const it of orderedItems) {
      const listing = listingsById.get(it.listing_id)
      if (!listing) { stale = true; break }
      members.push(listing)
    }
    // Defensive: drop any bundle whose members can't all be matched to
    // active listings on this shelf (e.g. one just sold but the
    // auto-archive trigger hasn't caught up yet).
    if (stale || members.length < 2) continue
    for (const m of members) listingIdsInBundles.add(m.id)
    bundles.push({
      id: b.id,
      name: b.name,
      description: b.description,
      pricing_mode: b.pricing_mode,
      discount_pct: b.discount_pct,
      price_gbp: b.price_gbp != null ? Number(b.price_gbp) : null,
      members,
    })
  }
  // Tag listings with has_bundles so ShelfGrid renders the corner badge.
  const safeListingsWithBundleFlag = safeListings.map((l) => ({
    ...l,
    has_bundles: listingIdsInBundles.has(l.id),
  }))

  // Profile fields (bio, avatar_url, location) exist but are empty for every
  // user, so identity is derived from what the person actually sells. For a
  // secondhand marketplace that is truer anyway: the shelf IS the identity.
  const catCounts = new Map<string, number>()
  for (const l of safeListings) {
    const c = (l as any).books?.category
    if (c) catCounts.set(c, (catCounts.get(c) ?? 0) + 1)
  }
  const topCategories = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c)

  const prices = safeListings
    .map((l: any) => Number(l.asking_price_gbp))
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
  const priceLow = prices[0]
  const priceHigh = prices[prices.length - 1]

  const sellingSince = user.registered_at
    ? formatDate(user.registered_at, { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="sy-page">

      <SiteNav />

      <div style={{ borderBottom: '1px solid var(--color-rule)', padding: '48px 0 36px' }}>
        <div className="sy-wrap sy-shelf-head" style={{ display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          {/* Avatar slot: photo when we have one, monogram until then. */}
          {user.avatar_url ? (
            <img className="sy-monogram" src={user.avatar_url} alt="" style={{ objectFit: 'cover' }} />
          ) : (
            <div className="sy-monogram" aria-hidden>
              {user.username.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="sy-h2" style={{ marginBottom: 10 }}>@{user.username}</h1>
            {/* A real bio wins when one exists. The derived line is the
                fallback, so enriching profiles later needs no redesign —
                it just starts winning. */}
            <p className="sy-lede" style={{ maxWidth: 640 }}>
              {user.bio ? user.bio : <>
              {topCategories.length > 0 ? (
                <>Mostly {topCategories.join(', ').replace(/, ([^,]*)$/, ' and $1')}.</>
              ) : (
                <>A shelf of secondhand books.</>
              )}{' '}
              {prices.length > 0 && (
                <>
                  <span className="sy-figure">£{priceLow.toFixed(2)}</span>–
                  <span className="sy-figure">£{priceHigh.toFixed(2)}</span>.
                </>
              )}{' '}
              </>}
            </p>
            {/* Own line, and specific: "several" doesn't tell anyone what to do. */}
            <p className="sy-prose" style={{ margin: '10px 0 0', maxWidth: 640 }}>
              Spend over £10 on this shelf for free shipping.
            </p>
            <div className="sy-shelf-facts">
              <span>
                <b className="sy-figure">{safeListings.length}</b>{' '}
                {safeListings.length === 1 ? 'book' : 'books'} for sale
              </span>
              {bundles.length > 0 && (
                <span>
                  <b className="sy-figure">{bundles.length}</b>{' '}
                  {bundles.length === 1 ? 'bundle' : 'bundles'}
                </span>
              )}
              {sellingSince && <span>Selling since {sellingSince}</span>}
              {user.location && <span>{user.location}</span>}
            </div>
          </div>
          {/* One node, two positions. On a wide screen it lifts out of flow
              into the header's top-right corner, where share lives on every
              other page. On a phone the header column is only ~240px — an
              @username alone needs 210 of it — so it stays in flow and
              right-aligns under the facts instead of colliding with the name. */}
          <div className="sy-shelf-share">
            <ShareButton
              url={`https://www.sellyourshelf.com/${user.username}`}
              title={`@${user.username}'s shelf`}
              kind="shelf"
              compact
            />
          </div>
        </div>
      </div>

      <div className="sy-wrap" style={{ padding: '36px 32px 8px' }}>
        <BundlesRow
          bundles={bundles}
          seller={{ sellerId: user.id, sellerUsername: user.username }}
        />
        <ThresholdGapAssistant
          listings={safeListings}
          seller={{ sellerId: user.id, sellerUsername: user.username }}
        />
        <ShelfGrid
          listings={safeListingsWithBundleFlag}
          seller={{ sellerId: user.id, sellerUsername: user.username }}
        />
      </div>

      <RegisterShelfInventory
        listings={safeListings}
        seller={{ sellerId: user.id, sellerUsername: user.username }}
      />
      <ShelfVisitTracker username={user.username} />

      <div style={{ background: 'var(--color-paper-warm)', borderTop: '1px solid var(--color-rule)', padding: '32px 24px' }}>
        <div className="sy-wrap" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-ink)', marginBottom: 6 }}>
            Got a shelf of your own?
          </p>
          <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', marginBottom: 20 }}>
            Scan, list and sell your books in 90 seconds with the app.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <AppBadges
              utm={{ source: 'shelf', medium: 'footer', campaign: `@${user.username}` }}
              size="md"
              layout="auto"
              align="center"
            />
          </div>
        </div>
      </div>

      <Footer />

    </div>
  )
}