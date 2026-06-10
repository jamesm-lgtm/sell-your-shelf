import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import ShelfGrid from '@/app/components/ShelfGrid'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import AppBadges from '@/app/components/AppBadges'
import CuratedRows from '@/app/components/CuratedRows'
import { getCuratedRows } from '@/app/lib/editorial'
import BundleDiscoveryRow, {
  type DiscoveryBundle,
  type DiscoveryBundleMember,
} from '@/app/components/BundleDiscoveryRow'
import { computeBundlePricing } from '@/app/lib/bundlePricing'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function generateMetadata() {
  return {
    title: 'Browse Books — Sell Your Shelf',
    description: 'Browse secondhand books for sale on Sell Your Shelf. Secure payments, tracked shipping.',
    openGraph: {
      title: 'Browse Books — Sell Your Shelf',
      description: 'Browse secondhand books for sale on Sell Your Shelf',
      url: 'https://sellyourshelf.com/new',
    },
    twitter: { card: 'summary_large_image' },
  }
}

type SearchParams = Promise<{ bundles?: string }>

export default async function NewInPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const params = searchParams ? await searchParams : {}
  const bundlesOnly = params.bundles === '1'

  const { data: listings } = await supabase
    .from('listings')
    .select(`
      id, title, author, asking_price_gbp, condition,
      books(cover_url, cover_url_hosted),
      listing_images(url, sort_order),
      users!inner(username, deleted_at)
    `)
    .eq('status', 'active')
    .is('users.deleted_at', null)
    .order('created_at', { ascending: false })

  const curatedRows = await getCuratedRows()

  const safeListings = (listings ?? []) as unknown as Array<{
    id: number
    title: string
    author: string | null
    asking_price_gbp: number
    condition: string
    books: { cover_url: string | null; cover_url_hosted?: string | null } | null
    listing_images: Array<{ url: string; sort_order: number }> | null
    users: { username: string } | null
  }>

  // Slice 10: tag listings with has_bundles so ShelfGrid renders the
  // "Bundle" badge on covers. One follow-up query for bundle_items
  // joined with bundles (active) restricted to the listing ids on this
  // page — keeps the cost bounded to the page size.
  const visibleListingIds = safeListings.map((l) => l.id)
  let listingIdsInBundles = new Set<number>()
  if (visibleListingIds.length > 0) {
    const { data: bundleMembers } = await supabase
      .from('bundle_items')
      .select('listing_id, bundle:bundles!inner(status)')
      .in('listing_id', visibleListingIds)
    if (bundleMembers) {
      for (const row of bundleMembers as unknown as Array<{
        listing_id: number
        bundle: { status: string } | { status: string }[] | null
      }>) {
        const b = (Array.isArray(row.bundle) ? row.bundle[0] : row.bundle) ?? null
        if (b?.status === 'active') listingIdsInBundles.add(row.listing_id)
      }
    }
  }
  const safeListingsWithBundleFlag = safeListings.map((l) => ({
    ...l,
    has_bundles: listingIdsInBundles.has(l.id),
  }))

  // Bundles-only filter (slice L13a). Toggling the chip just appends
  // ?bundles=1 and we drop everything that doesn't have a live
  // bundle covering it.
  const visibleListings = bundlesOnly
    ? safeListingsWithBundleFlag.filter((l) => l.has_bundles)
    : safeListingsWithBundleFlag

  // Slice L13b: marketplace-wide "Bundles to explore" row at the top
  // of the page. Only when NOT in bundles-only mode (we don't want
  // both rendered when the buyer has already opted into bundles).
  // Pulls the freshest 6 active bundles with hydrated members + a
  // computed pricing summary so the row renders the buyer-pays
  // total + savings.
  let discoveryBundles: DiscoveryBundle[] = []
  if (!bundlesOnly) {
    const { data: bRows } = await supabase
      .from('bundles')
      .select(`
        id,
        name,
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
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20)

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

    const buckets: DiscoveryBundle[] = []
    for (const raw of (bRows ?? []) as unknown as RawBundle[]) {
      const seller = Array.isArray(raw.seller) ? raw.seller[0] : raw.seller
      if (!seller || seller.deleted_at) continue
      const sortedItems = [...raw.bundle_items].sort((a, b) => a.sort_order - b.sort_order)
      const members: DiscoveryBundleMember[] = []
      let stale = false
      const memberPriceInputs: Array<{ listingId: number; askingPriceGbp: number }> = []
      for (const it of sortedItems) {
        const lRaw = Array.isArray(it.listing) ? it.listing[0] : it.listing
        if (!lRaw || lRaw.status !== 'active') { stale = true; break }
        const cover = lRaw.books?.cover_url_hosted || lRaw.books?.cover_url || null
        members.push({ id: lRaw.id, title: lRaw.title, cover_url: cover })
        // We need asking_price_gbp for pricing; fetch separately later
        // if not in projection. To keep one round-trip, we include it
        // in the select below.
        memberPriceInputs.push({ listingId: lRaw.id, askingPriceGbp: 0 })
      }
      if (stale || members.length < 2) continue
      buckets.push({
        id: raw.id,
        name: raw.name,
        sellerUsername: seller.username,
        members,
        // Placeholder — pricing recomputed below once we have asking
        // prices.
        bundlePriceGbp: 0,
        subtotalGbp: 0,
        savingsGbp: 0,
      })
    }

    // Second pass: enrich with asking_price_gbp so pricing is correct.
    // The previous query did NOT pull asking_price; do one batched
    // listings query for everything we kept.
    if (buckets.length > 0) {
      const allMemberIds = Array.from(
        new Set(buckets.flatMap((b) => b.members.map((m) => m.id))),
      )
      const { data: priceRows } = await supabase
        .from('listings')
        .select('id, asking_price_gbp')
        .in('id', allMemberIds)
      const priceById = new Map<number, number>()
      for (const row of (priceRows ?? []) as Array<{ id: number; asking_price_gbp: number }>) {
        priceById.set(row.id, Number(row.asking_price_gbp))
      }
      // Match raw bundles back so we can recompute pricing per bundle.
      const rawBundlesById = new Map(
        ((bRows ?? []) as unknown as RawBundle[]).map((r) => [r.id, r]),
      )
      for (const b of buckets) {
        const raw = rawBundlesById.get(b.id)
        if (!raw) continue
        const pricingInput = b.members
          .map((m) => ({
            listingId: m.id,
            askingPriceGbp: priceById.get(m.id) ?? 0,
          }))
          .filter((m) => m.askingPriceGbp > 0)
        if (pricingInput.length < 2) continue
        try {
          const pricing = computeBundlePricing({
            listings: pricingInput,
            pricingMode: raw.pricing_mode,
            discountPct: raw.discount_pct ?? undefined,
            priceGbp: raw.price_gbp != null ? Number(raw.price_gbp) : undefined,
          })
          b.bundlePriceGbp = pricing.bundlePriceGbp
          b.subtotalGbp = pricing.subtotalGbp
          b.savingsGbp = pricing.totalDiscountGbp
        } catch {
          /* drop pricing — keep row visible at least */
        }
      }
    }

    // Cap at 6 for the row.
    discoveryBundles = buckets.filter((b) => b.bundlePriceGbp > 0).slice(0, 6)
  }

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <SiteNav current="browse" />

      <div style={{ borderBottom: '0.5px solid #E5E3DF', padding: '32px 24px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          {/* Breadcrumbs */}
          <div style={{ fontSize: 12, color: '#999', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link href="/" style={{ color: '#999', textDecoration: 'none' }}>Home</Link>
            <span style={{ color: '#ccc' }}>/</span>
            <span style={{ color: '#666' }}>Browse</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>
            Browse Books
          </div>
          <div style={{ fontSize: 14, color: '#666' }}>
            {bundlesOnly
              ? `${visibleListings.length} books in bundles`
              : `${safeListings.length} books available — updated in real time`}
          </div>
        </div>
      </div>

      {/* Bundles-only toggle pill — sits above the category pills so
          it's a top-level filter. Toggling appends/strips ?bundles=1
          on the URL. */}
      <div style={{ borderBottom: '0.5px solid #E5E3DF', padding: '12px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <Link
            href={bundlesOnly ? '/new' : '/new?bundles=1'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 999,
              border: '1px solid #2D4A3E',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
              background: bundlesOnly ? '#2D4A3E' : '#FFFDF6',
              color: bundlesOnly ? '#FAF8F5' : '#2D4A3E',
            }}
          >
            <span aria-hidden style={{ fontSize: 14 }}>📚</span>
            Bundles only
            {bundlesOnly && (
              <span aria-hidden style={{ marginLeft: 4 }}>×</span>
            )}
          </Link>
        </div>
      </div>

      {/* Category pills */}
      <div style={{ borderBottom: '0.5px solid #E5E3DF', padding: '12px 24px', overflow: 'auto' }}>
        <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', gap: 8, flexWrap: 'nowrap' }}>
          {[
            { slug: 'fiction', name: 'Fiction' },
            { slug: 'childrens', name: "Children's" },
            { slug: 'biography-memoir', name: 'Biography & Memoir' },
            { slug: 'crime-thriller', name: 'Crime & Thriller' },
            { slug: 'self-help', name: 'Self-Help' },
            { slug: 'history', name: 'History' },
            { slug: 'reference-education', name: 'Reference & Education' },
            { slug: 'business-finance', name: 'Business & Finance' },
            { slug: 'literary-fiction', name: 'Literary Fiction' },
            { slug: 'travel', name: 'Travel' },
            { slug: 'cookery-food', name: 'Cookery & Food' },
            { slug: 'art-photography', name: 'Art & Photography' },
            { slug: 'science-nature', name: 'Science & Nature' },
            { slug: 'young-adult', name: 'Young Adult' },
            { slug: 'classic-fiction', name: 'Classic Fiction' },
            { slug: 'historical-fiction', name: 'Historical Fiction' },
            { slug: 'romance', name: 'Romance' },
            { slug: 'sci-fi-fantasy', name: 'Sci-Fi & Fantasy' },
            { slug: 'comics-graphic-novels', name: 'Comics & Graphic Novels' },
          ].map(cat => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              style={{
                fontSize: 12, padding: '6px 14px', borderRadius: 20, textDecoration: 'none', whiteSpace: 'nowrap',
                background: '#fff', color: '#666', border: '0.5px solid #E5E3DF',
              }}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Marketplace bundle discovery (slice L13b) — only shown when
          not already filtered to bundles-only. */}
      {!bundlesOnly && <BundleDiscoveryRow bundles={discoveryBundles} />}

      <CuratedRows rows={curatedRows} />

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
        <ShelfGrid listings={visibleListings} showSeller pageSize={24} />
      </div>

      <div style={{ background: '#F0EDE8', borderTop: '0.5px solid #E5E3DF', padding: '32px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A', marginBottom: 6 }}>
            Browse on the go
          </p>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
            Get push alerts for new listings and message sellers from your phone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <AppBadges
              utm={{ source: 'new_in', medium: 'footer', campaign: 'get_the_app' }}
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
