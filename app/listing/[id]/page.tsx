import { notFound, permanentRedirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { offerShippingDetails, merchantReturnPolicy } from '@/app/lib/offerSchema'
import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import AppBadges from '@/app/components/AppBadges'
import ListingDeepLink from '@/app/components/ListingDeepLink'
import ListingViewTracker from '@/app/components/ListingViewTracker'
import AddToBasketButton from '@/app/components/AddToBasketButton'
import ListingBundleStrip, { type BundleStripBundle, type BundleStripMember } from '@/app/components/ListingBundleStrip'
import { computeBundlePricing } from '@/app/lib/bundlePricing'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const CONDITIONS: Record<string, string> = {
  like_new: 'Like New',
  very_good: 'Very Good',
  good: 'Good',
  acceptable: 'Acceptable',
}

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params

  const { data } = await supabase
    .from('marketplace_listings')
    // Covers are no longer needed here — the opengraph-image route
    // fetches its own and composes the share card.
    .select('title, author, asking_price_gbp, condition, book_id')
    .eq('id', id)
    .single()

  if (!data) return { title: 'Listing not found — Sell Your Shelf' }

  // Canonical: copies of the same book are near-duplicate pages. Pointing
  // them at the book hub concentrates ranking signal on one URL per title —
  // the page that shows every copy — instead of splitting it across
  // per-copy pages that die when the copy sells.
  const { data: bookRow } = data.book_id
    ? await supabase.from('books').select('slug').eq('id', data.book_id).single()
    : { data: null }
  const canonical = bookRow?.slug ? `/books/${bookRow.slug}` : `/listing/${id}`

  const condition = CONDITIONS[data.condition as string] ?? null
  const description =
    `${data.author ? `by ${data.author} — ` : ''}` +
    `${condition ? `${condition} condition, ` : ''}` +
    `£${Number(data.asking_price_gbp).toFixed(2)} on Sell Your Shelf`

  return {
    title: `${data.title} — Sell Your Shelf`,
    description,
    alternates: { canonical },
    // `images` omitted so the opengraph-image route supplies the card —
    // see the note in app/lib/ogCard.tsx on why a raw cover fares badly.
    openGraph: {
      title: `${data.title} on Sell Your Shelf`,
      description,
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params

  const { data: listing, error } = await supabase
    .from('marketplace_listings')
    .select('*')
    .eq('id', id)
    .single()

  // Sold/removed copies must not 404 — that throws away every backlink and
  // ranking signal the page earned. Send them to the durable book hub with
  // a permanent redirect; only drafts and unknown ids 404.
  async function redirectGoneListing(): Promise<never> {
    const { data: gone } = await supabase
      .from('listings')
      .select('status, books(slug)')
      .eq('id', id)
      .maybeSingle()
    const bookRef = gone?.books as { slug: string | null } | { slug: string | null }[] | null
    const slug = (Array.isArray(bookRef) ? bookRef[0]?.slug : bookRef?.slug) ?? null
    if (gone && ['sold', 'removed'].includes(gone.status) && slug) {
      permanentRedirect(`/books/${slug}`)
    }
    notFound()
  }

  if (error || !listing) {
    return await redirectGoneListing()
  }

  // Check listing is still active (marketplace_listings is a view, double-check status)
  const { data: rawListing } = await supabase
    .from('listings')
    .select('status, user_id, format')
    .eq('id', id)
    .single()

  if (!rawListing || rawListing.status !== 'active') {
    return await redirectGoneListing()
  }

  // Use edition cover if available, fallback to work cover — prefer hosted URLs
  const cover = listing.edition_cover_hosted || listing.edition_cover || listing.work_cover_hosted || listing.work_cover
  const description = listing.edition_description || listing.work_description || listing.description
  const category = listing.category
  const username = listing.seller_name
  const hasEditionData = !!(listing.edition_cover || listing.edition_publisher || listing.edition_page_count)

  // Get normalized fields for slug from books table
  const { data: bookData } = listing.book_id ? await supabase
    .from('books')
    .select('title_normalized, author_normalized, slug')
    .eq('id', listing.book_id)
    .single() : { data: null }

  const bookSlug = bookData?.slug || (bookData?.title_normalized
    ? `${bookData.title_normalized}-${bookData.author_normalized || ''}`
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    : null)

  // ---- Bundle strip (slice 9) ----------------------------------------
  // Find any active bundles this listing belongs to (most listings won't
  // be in any; some will be in one; very rarely more). For each, fetch
  // the other members + pre-compute pricing so the client island just
  // renders. Bundles with stale membership (member listing no longer
  // active) are dropped — the auto-archive trigger normally catches
  // this but there's a small race window.
  const listingIdNum = Number(id)
  const { data: bundleMemberRows } = await supabase
    .from('bundle_items')
    .select(`
      bundle:bundles!inner (
        id,
        seller_id,
        name,
        description,
        pricing_mode,
        discount_pct,
        price_gbp,
        status,
        bundle_items (
          listing_id,
          sort_order,
          listing:listings (
            id,
            title,
            author,
            asking_price_gbp,
            status,
            format,
            books ( cover_url, cover_url_hosted, category ),
            listing_images ( url, sort_order )
          )
        )
      )
    `)
    .eq('listing_id', listingIdNum)

  type RawBundle = {
    id: number
    seller_id: string
    name: string
    description: string | null
    pricing_mode: 'discount' | 'absolute'
    discount_pct: number | null
    price_gbp: number | null
    status: string
    bundle_items: Array<{
      listing_id: number
      sort_order: number
      listing: BundleStripMember & { status: string } | null
    }>
  }

  const stripBundles: BundleStripBundle[] = []
  for (const row of (bundleMemberRows ?? []) as unknown as Array<{ bundle: RawBundle | RawBundle[] | null }>) {
    const b = (Array.isArray(row.bundle) ? row.bundle[0] : row.bundle) ?? null
    if (!b) continue
    if (b.status !== 'active') continue
    // Only show bundles owned by THIS listing's seller — guards against
    // the (shouldn't-happen) edge case where membership crosses sellers.
    if (b.seller_id !== rawListing.user_id) continue

    const orderedItems = [...b.bundle_items].sort((x, y) => x.sort_order - y.sort_order)
    const members: BundleStripMember[] = []
    let stale = false
    for (const it of orderedItems) {
      const listingRaw = it.listing as unknown
      const listing = (Array.isArray(listingRaw) ? listingRaw[0] : listingRaw) as
        | (BundleStripMember & { status: string })
        | null
      if (!listing || listing.status !== 'active') { stale = true; break }
      members.push(listing)
    }
    if (stale || members.length < 2) continue

    const pricing = computeBundlePricing({
      listings: members.map((m) => ({
        listingId: m.id,
        askingPriceGbp: Number(m.asking_price_gbp),
      })),
      pricingMode: b.pricing_mode,
      discountPct: b.discount_pct ?? undefined,
      priceGbp: b.price_gbp != null ? Number(b.price_gbp) : undefined,
    })

    stripBundles.push({
      id: b.id,
      name: b.name,
      description: b.description,
      members,
      bundlePriceGbp: pricing.bundlePriceGbp,
      totalDiscountGbp: pricing.totalDiscountGbp,
      // Server-computed per-line breakdown so the client island can
      // populate effective prices when adding to basket. Avoids the
      // client having to import bundlePricing.
      lines: Object.fromEntries(
        pricing.lines.map((l) => [
          l.listingId,
          {
            effectivePriceGbp: l.effectivePriceGbp,
            originalPriceGbp: l.originalPriceGbp,
            discountGbp: l.discountGbp,
          },
        ]),
      ),
    })
  }

  // Product entity with a concrete Offer — price, availability and condition
  // are what qualify the page for price-annotated results. The seller's own
  // photo (if any) leads the image array: it is the actual item.
  const listingUrl = `https://www.sellyourshelf.com/listing/${id}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    ...(listing.author ? { brand: { '@type': 'Brand', name: listing.author } } : {}),
    ...(cover ? { image: [listing.seller_cover_url, cover].filter(Boolean) } : {}),
    ...(description ? { description: String(description).replace(/\s+/g, ' ').slice(0, 500) } : {}),
    sku: String(id),
    ...(listing.isbn && String(listing.isbn).replace(/[^0-9]/g, '').length === 13
      ? { gtin13: String(listing.isbn).replace(/[^0-9]/g, '') }
      : {}),
    offers: {
      '@type': 'Offer',
      url: listingUrl,
      price: Number(listing.asking_price_gbp).toFixed(2),
      priceCurrency: 'GBP',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
      shippingDetails: offerShippingDetails(Number(listing.asking_price_gbp)),
      hasMerchantReturnPolicy: merchantReturnPolicy,
      ...(username ? { seller: { '@type': 'Person', name: `@${username}` } } : {}),
    },
  }

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ListingDeepLink listingId={id} />

      <SiteNav />

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>

        {/* Breadcrumbs */}
        <div style={{ fontSize: 12, color: '#999', marginBottom: 20, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: '#999', textDecoration: 'none' }}>Home</Link>
          <span style={{ color: '#ccc' }}>/</span>
          <Link href="/new" style={{ color: '#999', textDecoration: 'none' }}>Browse</Link>
          {bookSlug && (
            <>
              <span style={{ color: '#ccc' }}>/</span>
              <Link href={`/books/${bookSlug}`} style={{ color: '#999', textDecoration: 'none' }}>{listing.title}</Link>
            </>
          )}
          <span style={{ color: '#ccc' }}>/</span>
          <span style={{ color: '#666' }}>This copy</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 32, alignItems: 'start', marginBottom: 32 }}>
          <div>
            <div style={{ borderRadius: 10, overflow: 'hidden', background: '#2D4A3E', aspectRatio: '2/3' }}>
              {cover ? (
                <img src={cover} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, padding: 8, textAlign: 'center' }}>{listing.title}</span>
                </div>
              )}
            </div>
            {cover && !hasEditionData && (
              <p style={{ fontSize: 10, color: '#999', marginTop: 6, lineHeight: 1.4 }}>
                Cover image is for illustration. Actual edition may vary.
              </p>
            )}
          </div>

          <div>
            {category && (
              <div style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                {category}
              </div>
            )}
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3, marginBottom: 6 }}>
              {listing.title}
            </h1>
            {listing.author && (
              <p style={{ fontSize: 15, color: '#666', marginBottom: 8 }}>
                {listing.author}
              </p>
            )}

            {hasEditionData && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#DCFCE7', color: '#166534', fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 4, marginBottom: 12 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                Specific Edition
              </div>
            )}

            {(listing.isbn || listing.edition_publisher || listing.edition_page_count || listing.format) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {listing.format && (
                  <span style={{ fontSize: 11, color: '#666', background: '#F0EDE8', padding: '3px 8px', borderRadius: 4, textTransform: 'capitalize' }}>
                    {listing.format}
                  </span>
                )}
                {listing.edition_publisher && (
                  <span style={{ fontSize: 11, color: '#666', background: '#F0EDE8', padding: '3px 8px', borderRadius: 4 }}>
                    {listing.edition_publisher}
                  </span>
                )}
                {listing.edition_page_count && (
                  <span style={{ fontSize: 11, color: '#666', background: '#F0EDE8', padding: '3px 8px', borderRadius: 4 }}>
                    {listing.edition_page_count} pages
                  </span>
                )}
                {listing.isbn && (
                  <span style={{ fontSize: 11, color: '#666', background: '#F0EDE8', padding: '3px 8px', borderRadius: 4 }}>
                    ISBN: {listing.isbn}
                  </span>
                )}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 28, fontWeight: 600, color: '#2D4A3E', display: 'block', marginBottom: 8 }}>
                £{Number(listing.asking_price_gbp).toFixed(2)}
              </span>
              <span style={{ fontSize: 12, color: '#666', background: '#F0EDE8', padding: '4px 10px', borderRadius: 4 }}>
                {CONDITIONS[listing.condition] ?? listing.condition}
              </span>
            </div>

            {username && (
              <Link href={`/${username}`} style={{ fontSize: 13, color: '#2D4A3E', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Sold by @{username} →
              </Link>
            )}

          </div>
        </div>

        {listing.notes && (
          <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: '#666', fontWeight: 500, marginBottom: 6 }}>Seller's note</p>
            <p style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.6 }}>{listing.notes}</p>
          </div>
        )}

        {description && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: '#999', fontWeight: 500, marginBottom: 8 }}>About this book</p>
            {/* Full text, split into paragraphs — no truncation. Crawlers
                index the whole synopsis; readers get real paragraphs. */}
            {String(description).split(/\n{2,}|\n/).map(p => p.trim()).filter(Boolean).map((p, i, arr) => (
              <p key={i} style={{ fontSize: 14, color: '#444', lineHeight: 1.7, marginBottom: i === arr.length - 1 ? 0 : 10 }}>
                {p}
              </p>
            ))}
          </div>
        )}

        {username && rawListing.user_id && stripBundles.length > 0 && (
          <ListingBundleStrip
            bundles={stripBundles}
            seller={{ sellerId: rawListing.user_id as string, sellerUsername: username }}
            currentListingId={listingIdNum}
          />
        )}

        {username && rawListing.user_id && (
          <div style={{ marginBottom: 16 }}>
            <AddToBasketButton
              seller={{ sellerId: rawListing.user_id as string, sellerUsername: username }}
              item={{
                listingId: Number(id),
                title: listing.title,
                author: listing.author ?? null,
                priceGbp: Number(listing.asking_price_gbp),
                format: (rawListing.format as 'paperback' | 'hardback' | null) ?? null,
                coverUrl: cover ?? null,
                category: listing.category ?? null,
              }}
            />
          </div>
        )}

        {bookSlug && (
          <Link
            href={`/books/${bookSlug}`}
            style={{ display: 'block', textAlign: 'center', background: '#fff', color: '#2D4A3E', fontSize: 14, fontWeight: 500, padding: '12px 32px', borderRadius: 8, textDecoration: 'none', marginBottom: 32, border: '1px solid #2D4A3E' }}
          >
            See other copies of this book →
          </Link>
        )}

        <div style={{ background: '#F0EDE8', borderRadius: 12, padding: '20px 24px' }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', marginBottom: 2 }}>
            Want to sell your books?
          </p>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
            List 30 books in 90 seconds with AI shelf scanning
          </p>
          <AppBadges
            utm={{ source: 'listing', medium: 'footer', campaign: `listing_${id}` }}
            size="md"
            layout="auto"
          />
        </div>

      </div>

      <ListingViewTracker listingId={Number(id)} />

      <Footer />

    </div>
  )
}