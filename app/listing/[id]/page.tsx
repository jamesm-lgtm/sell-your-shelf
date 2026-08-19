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
import { resolveBookCover } from '@/app/lib/coverUrl'
import { BookCard } from '@/app/components/ui'
import ShareButton from '@/app/components/ShareButton'

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
    .select('title, author, asking_price_gbp, condition, book_id, edition_cover, work_cover, edition_cover_hosted, work_cover_hosted')
    .eq('id', id)
    .single()

  if (!data) return { title: 'Listing not found — Sell Your Shelf' }

  const cover = data.edition_cover_hosted || data.edition_cover || data.work_cover_hosted || data.work_cover

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
    openGraph: {
      title: `${data.title} on Sell Your Shelf`,
      description,
      images: cover ? [{ url: cover }] : [],
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

  // More from this shelf. Same seller, still active, excluding this copy —
  // the cross-sell that actually pays off, because a second book from the
  // same seller ships in the same parcel.
  let shelfMore: Array<{ id: number; title: string; author: string | null; price: number; cover: string | null }> = []
  if (rawListing.user_id) {
    const { data: more } = await supabase
      .from('listings')
      .select('id, title, author, asking_price_gbp, books(cover_url, cover_url_hosted), listing_images(url, sort_order)')
      .eq('status', 'active')
      .eq('user_id', rawListing.user_id)
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(24)
    shelfMore = ((more ?? []) as any[])
      .map((m) => ({
        id: m.id,
        title: m.title,
        author: m.author,
        price: Number(m.asking_price_gbp),
        cover: resolveBookCover(m.books, m.listing_images),
      }))
      .filter((m) => m.cover)
      .slice(0, 12)
  }
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
    <div className="sy-page">

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ListingDeepLink listingId={id} />

      <SiteNav />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 32px 64px' }}>

        {/* Where you are, and what you can do with this page. */}
        <div className="sy-pagebar">
          <div className="sy-crumbs">
            <Link href="/">Home</Link>
            <span className="sy-crumb-sep">/</span>
            <Link href="/new">Browse</Link>
            {bookSlug && (
              <>
                {/* The title is the long one — it goes first on a phone. */}
                <span className="sy-crumb-sep sy-crumb-drop">/</span>
                <Link href={`/books/${bookSlug}`} className="sy-crumb-drop">{listing.title}</Link>
              </>
            )}
            <span className="sy-crumb-sep">/</span>
            <span className="sy-crumb-here">This copy</span>
          </div>
          <ShareButton
            url={`https://www.sellyourshelf.com/listing/${id}`}
            title={listing.title}
            kind="book"
            compact
          />
        </div>

        <div className="sy-listing-split">
          <div>
            <div className="sy-cover">
              {cover ? (
                <img src={cover} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.95)', fontSize: 16, fontWeight: 600, lineHeight: 1.25, padding: 16, textAlign: 'center' }}>{listing.title}</span>
                </div>
              )}
            </div>
            {cover && !hasEditionData && (
              <p style={{ fontSize: 12, color: 'var(--color-ink-faint)', marginTop: 8, lineHeight: 1.4 }}>
                Cover image is for illustration. Actual edition may vary.
              </p>
            )}
          </div>

          <div>
            {category && (
              <div className="sy-mark" style={{ color: 'var(--color-ink-faint)', marginBottom: 10 }}>
                {category}
              </div>
            )}
            <h1 className="sy-h2" style={{ marginBottom: 8 }}>
              {listing.title}
            </h1>
            {listing.author && (
              <p style={{ fontSize: 16, color: 'var(--color-ink-soft)', marginBottom: 10 }}>
                {listing.author}
              </p>
            )}

            {hasEditionData && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-cond-like-new)', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                Specific Edition
              </div>
            )}

            {(listing.isbn || listing.edition_publisher || listing.edition_page_count || listing.format) && (
              <dl className="sy-editiontable">
                {listing.format && (
                  <div>
                    <dt>Format</dt>
                    <dd style={{ textTransform: 'capitalize' }}>{listing.format}</dd>
                  </div>
                )}
                {listing.edition_publisher && (
                  <div>
                    <dt>Publisher</dt>
                    <dd>{listing.edition_publisher}</dd>
                  </div>
                )}
                {listing.edition_page_count && (
                  <div>
                    <dt>Pages</dt>
                    <dd className="sy-figure">{listing.edition_page_count}</dd>
                  </div>
                )}
                {listing.isbn && (
                  <div>
                    <dt>ISBN</dt>
                    <dd className="sy-figure sy-isbn">{listing.isbn}</dd>
                  </div>
                )}
              </dl>
            )}

            <div style={{ marginBottom: 20 }}>
              <span className="sy-price" style={{ fontSize: 32, display: 'block', marginBottom: 10 }}>
                £{Number(listing.asking_price_gbp).toFixed(2)}
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-ink-soft)', background: 'var(--color-paper-warm)', padding: '5px 12px', borderRadius: 'var(--radius-pill)' }}>
                {CONDITIONS[listing.condition] ?? listing.condition}
              </span>
            </div>

            {username && (
              <Link href={`/${username}`} style={{ fontSize: 14, color: 'var(--color-action)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Sold by @{username} →
              </Link>
            )}
            <div style={{ height: 28 }} aria-hidden />

          {listing.notes && (
            <div className="sy-panel" style={{ marginBottom: 26 }}>
              <p className="sy-mark" style={{ color: 'var(--color-ink-faint)', marginBottom: 10 }}>Seller&rsquo;s note</p>
              <p style={{ fontSize: 15, color: 'var(--color-ink)', lineHeight: 1.64 }}>{listing.notes}</p>
            </div>
          )}

          {description && (
            <div style={{ marginBottom: 24 }}>
              <p className="sy-mark" style={{ color: 'var(--color-ink-faint)', marginBottom: 12 }}>About this book</p>
              {/* Full text, split into paragraphs — no truncation. Crawlers
                  index the whole synopsis; readers get real paragraphs. */}
              {String(description).split(/\n{2,}|\n/).map(p => p.trim()).filter(Boolean).map((p, i, arr) => (
                <p key={i} style={{ fontSize: 14, color: 'var(--color-ink-soft)', lineHeight: 1.7, marginBottom: i === arr.length - 1 ? 0 : 10 }}>
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
              className="sy-cta sy-cta-quiet" style={{ display: 'flex', marginBottom: 34 }}
            >
              See other copies of this book →
            </Link>
          )}

          </div>
        </div>

        {shelfMore.length > 0 && username && (
          <section style={{ margin: '8px 0 44px' }}>
            <div className="sy-rail-head" style={{ marginBottom: 4 }}>
              <h2 className="sy-h3" style={{ margin: 0 }}>More from @{username}&rsquo;s shelf</h2>
              <Link href={`/${username}`} style={{ fontSize: 14, color: 'var(--color-action)', textDecoration: 'none', fontWeight: 600 }}>
                See the shelf →
              </Link>
            </div>
            <p style={{ fontSize: 15, color: 'var(--color-ink-soft)', margin: '10px 0 0', lineHeight: 1.5, maxWidth: 620 }}>
              Add any of these and they ship in the same parcel. Free delivery over £10.
            </p>
            <div
              className="sy-rail"
              /* Inside a page container the rail must not re-apply the page
                 gutter — it would double-indent. Inline so it can't be lost
                 to specificity or a stale stylesheet. */
              style={{ paddingInline: '0 24px', scrollPaddingInline: '0 24px' }}
            >
              {shelfMore.map((m) => (
                <div key={m.id} className="sy-rail-item">
                  <BookCard href={`/listing/${m.id}`} book={{ id: m.id, title: m.title, author: m.author, price: m.price, cover: m.cover }} />
                </div>
              ))}
            </div>
          </section>
        )}

        <div style={{ background: 'var(--color-paper-warm)', borderRadius: 'var(--radius-md)', padding: '40px 26px', textAlign: 'center' }}>
          <p className="sy-h3" style={{ marginBottom: 6 }}>
            Want to sell your books?
          </p>
          <p style={{ fontSize: 14, color: 'var(--color-ink-soft)', marginBottom: 20 }}>
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