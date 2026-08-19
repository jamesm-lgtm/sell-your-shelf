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
import { resolveBookCover } from '@/app/lib/coverUrl'
import { buildFlow, DEFAULT_FLOW_RULES } from '@/app/lib/browseFlow'
import { BookCard, BookGrid, formatCount } from '@/app/components/ui'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// PostgREST caps a request at 1000 rows by default, and the browse query
// had no .limit() — so it silently saw 1000 of 3622 active listings and
// 2622 never appeared, at any filter. Range-paginate until exhausted.
const PAGE = 1000
async function fetchAllListings(restrictToIds: number[] | null) {
  const rows: any[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('listings')
      .select(`
        id, title, author, asking_price_gbp, condition, user_id,
        books(cover_url, cover_url_hosted, category),
        listing_images(url, sort_order),
        users!inner(username, deleted_at)
      `)
      .eq('status', 'active')
      .is('users.deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (restrictToIds) q = q.in('id', restrictToIds)
    const { data } = await q
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

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

type SearchParams = Promise<{ bundles?: string; band?: string; cat?: string; all?: string; more?: string }>

export default async function NewInPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const params = searchParams ? await searchParams : {}
  const bundlesOnly = params.bundles === '1'
  const band = params.band ?? ''
  const cat = params.cat ?? ''
  const showAll = params.all === '1'
  const pagesShown = Math.max(1, Number(params.more ?? '1') || 1)

  // When the buyer asks for bundles only, query the bundle universe
  // FIRST and then restrict the listings query to just those ids.
  // Avoids the previous bug where the 1000-row default cap on the
  // listings query could exclude bundled listings, making the filter
  // appear to show 0 results even when bundles existed (the badge
  // computation needed those listings to be in the first 1000).
  let bundledListingIdsUpfront: number[] | null = null
  if (bundlesOnly) {
    const { data: bms } = await supabase
      .from('bundle_items')
      .select('listing_id, bundle:bundles!inner(status)')
    const collected = new Set<number>()
    for (const row of (bms ?? []) as unknown as Array<{
      listing_id: number
      bundle: { status: string } | { status: string }[] | null
    }>) {
      const b = (Array.isArray(row.bundle) ? row.bundle[0] : row.bundle) ?? null
      if (b?.status === 'active') collected.add(row.listing_id)
    }
    bundledListingIdsUpfront = Array.from(collected)
  }

  let listings: unknown
  if (bundlesOnly) {
    if (!bundledListingIdsUpfront || bundledListingIdsUpfront.length === 0) {
      listings = []
    } else {
      listings = await fetchAllListings(bundledListingIdsUpfront)
    }
  } else {
    listings = await fetchAllListings(null)
  }

  const curatedRows = await getCuratedRows()

  const safeListings = (listings ?? []) as unknown as Array<{
    id: number
    title: string
    author: string | null
    asking_price_gbp: number
    condition: string
    user_id: string | null
    books: { cover_url: string | null; cover_url_hosted?: string | null; category?: string | null } | null
    listing_images: Array<{ url: string; sort_order: number }> | null
    users: { username: string } | null
  }>

  // Slice 10: tag listings with has_bundles so ShelfGrid renders the
  // "Bundle" badge on covers. When the buyer's already filtered to
  // bundles-only we know every visible listing is bundled (we used
  // that set to drive the query upstream), so skip the lookup.
  // Otherwise: one follow-up query for bundle_items joined with
  // bundles (active) restricted to the listing ids on this page.
  let listingIdsInBundles = new Set<number>()
  if (bundlesOnly) {
    listingIdsInBundles = new Set(bundledListingIdsUpfront ?? [])
  } else {
    const visibleListingIds = safeListings.map((l) => l.id)
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
        description: raw.description ?? null,
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

    // The rail scrolls, so the cap is about query weight, not layout.
    // 6 was leaving most of ~58 active bundles unreachable from browse.
    discoveryBundles = buckets.filter((b) => b.bundlePriceGbp > 0).slice(0, 18)
  }

  // ---- Shop-window flow -------------------------------------------------
  // Curated rows lead, bundles follow, then a gated and seller-capped
  // "new in" flow. Rules and rationale live in lib/browseFlow.ts.

  const PRICE_BANDS: Array<{ key: string; label: string; min: number; max: number }> = [
    { key: 'under3', label: 'Under £3', min: 0, max: 3 },
    { key: '3to6', label: '£3–£6', min: 3, max: 6 },
    { key: '6to15', label: '£6–£15', min: 6, max: 15 },
    { key: 'over15', label: '£15+', min: 15, max: Infinity },
  ]

  const categories = Array.from(
    new Set(
      safeListingsWithBundleFlag
        .map((l) => l.books?.category)
        .filter((c): c is string => Boolean(c)),
    ),
  ).sort()

  const activeBand = PRICE_BANDS.find((b) => b.key === band) ?? null

  // Filters scope the flow, never the curated rows — a collection is an
  // editorial statement and shouldn't silently lose books to a price filter.
  const scoped = visibleListings.filter((l) => {
    const price = Number(l.asking_price_gbp)
    if (activeBand && !(price >= activeBand.min && price < activeBand.max)) return false
    if (cat && l.books?.category !== cat) return false
    return true
  })

  const asFlow = scoped.map((l) => ({
    ...l,
    cover: resolveBookCover(l.books, l.listing_images),
    category: l.books?.category ?? null,
    sellerId: l.user_id ?? null,
  }))

  const { flow, pages, heldBackByGate } = buildFlow(asFlow, DEFAULT_FLOW_RULES)

  // "See everything" drops the gate and the cap but keeps the filters —
  // and still paginates. Rendering the ungated catalogue in one go put
  // 3,626 cards in a single DOM, which is unusable on a phone.
  const ALL_PAGE = DEFAULT_FLOW_RULES.pageSize
  const shown = showAll
    ? asFlow.slice(0, ALL_PAGE * pagesShown)
    : flow.slice(0, pages.slice(0, pagesShown).reduce((a, b) => a + b, 0))
  const hasMore = showAll
    ? ALL_PAGE * pagesShown < asFlow.length
    : pagesShown < pages.length
  const remainingCount = showAll
    ? asFlow.length - shown.length
    : asFlow.length - flow.length

  const qs = (over: Record<string, string | undefined>) => {
    const base: Record<string, string | undefined> = {
      bundles: bundlesOnly ? '1' : undefined,
      band: band || undefined,
      cat: cat || undefined,
      all: showAll ? '1' : undefined,
      more: pagesShown > 1 ? String(pagesShown) : undefined,
      ...over,
    }
    const q = Object.entries(base)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&')
    return q ? `/new?${q}` : '/new'
  }

  return (
    <div className="sy-page">
      <SiteNav current="browse" />

      <section className="sy-wrap" style={{ paddingTop: 56, paddingBottom: 8 }}>
        <h1 className="sy-h1">Shop books</h1>
        <p className="sy-lede" style={{ marginTop: 14, maxWidth: 560 }}>
          Secondhand books from readers across the UK. Buy several from one seller and
          they ship together.
        </p>
      </section>

      {/* The shop window: hand-picked collections lead the page. */}
      <CuratedRows rows={curatedRows} />

      {/* Seller-made collections. Not a page mode — content. */}
      {discoveryBundles.length > 0 && <BundleDiscoveryRow bundles={discoveryBundles} />}

      {/* Filters scope the flow below, not the window above. */}
      <section className="sy-wrap" style={{ paddingTop: 48 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Link href={qs({ band: undefined, cat: undefined, more: undefined })}
            className={`sy-chip${!band && !cat && !bundlesOnly ? ' is-active' : ''}`}>
            All books
          </Link>
          <Link href={qs({ bundles: bundlesOnly ? undefined : '1', more: undefined })}
            className={`sy-chip${bundlesOnly ? ' is-active' : ''}`}>
            In a bundle
          </Link>
          {PRICE_BANDS.map((b) => (
            <Link key={b.key} href={qs({ band: band === b.key ? undefined : b.key, more: undefined })}
              className={`sy-chip${band === b.key ? ' is-active' : ''}`}>
              {b.label}
            </Link>
          ))}
        </div>

        {categories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {categories.slice(0, 12).map((c) => (
              <Link key={c} href={qs({ cat: cat === c ? undefined : c, more: undefined })}
                className={`sy-chip${cat === c ? ' is-active' : ''}`}>
                {c}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* New in — always the bottom of the page, always fresh. */}
      <section className="sy-wrap" style={{ paddingTop: 44, paddingBottom: 88 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <h2 className="sy-h2" style={{ margin: 0 }}>{showAll ? 'Everything' : 'New in'}</h2>
          <span className="sy-mark" style={{ color: 'var(--color-ink-faint)' }}>
            {formatCount(shown.length)} {shown.length === 1 ? 'book' : 'books'}
          </span>
        </div>

        {shown.length === 0 ? (
          <p className="sy-lede">
            Nothing matches those filters yet.{' '}
            <Link href="/new" style={{ color: 'var(--color-action)' }}>Clear them</Link> to see everything.
          </p>
        ) : (
          <BookGrid>
            {shown.map((l) => (
              <BookCard
                key={l.id}
                href={`/listing/${l.id}`}
                book={{
                  id: l.id,
                  title: l.title,
                  author: l.author,
                  price: Number(l.asking_price_gbp),
                  cover: l.cover,
                  inBundle: l.has_bundles,
                }}
              />
            ))}
          </BookGrid>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 40 }}>
          {hasMore && (
            <Link href={qs({ more: String(pagesShown + 1) })} className="sy-cta sy-cta-quiet">
              Show more
            </Link>
          )}
          {!showAll && remainingCount > 0 && (
            <Link href={qs({ all: '1', more: undefined })} className="sy-cta sy-cta-quiet">
              See all {formatCount(asFlow.length)} books
            </Link>
          )}
          {showAll && (
            <Link href={qs({ all: undefined, more: undefined })} className="sy-cta sy-cta-quiet">
              Back to new in
            </Link>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}
