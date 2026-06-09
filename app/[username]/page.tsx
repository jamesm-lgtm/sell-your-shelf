import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import ShelfGrid from '@/app/components/ShelfGrid'
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
    .select('id, username, location')
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

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <SiteNav />

      <div style={{ borderBottom: '0.5px solid #E5E3DF', padding: '32px 24px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#2D4A3E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FAF8F5', fontSize: 20, fontWeight: 500, flexShrink: 0 }}>
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#1A1A1A' }}>
              @{user.username}
            </div>
            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
              {safeListings.length} {safeListings.length === 1 ? 'book' : 'books'} for sale
              {user.location ? ` · ${user.location}` : ''}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
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

      <div style={{ background: '#F0EDE8', borderTop: '0.5px solid #E5E3DF', padding: '32px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A', marginBottom: 6 }}>
            Got a shelf of your own?
          </p>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
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