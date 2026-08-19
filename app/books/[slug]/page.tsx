import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import AppBadges from '@/app/components/AppBadges'
import BuyNowLink from '@/app/components/BuyNowLink'
import BookViewTracker from '@/app/components/BookViewTracker'
import { Price, ConditionMarker } from '@/app/components/ui'
import ShareButton from '@/app/components/ShareButton'
import { offerShippingDetails, merchantReturnPolicy } from '@/app/lib/offerSchema'
import { findBookBySlug } from '@/app/lib/bookLookup'

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

const CONDITION_COLORS: Record<string, { bg: string; text: string }> = {
  like_new: { bg: '#DCFCE7', text: '#166534' },
  very_good: { bg: '#DBEAFE', text: '#1E40AF' },
  good: { bg: '#FEF9C3', text: '#854D0E' },
  acceptable: { bg: '#F3F4F6', text: '#374151' },
}

/** schema.org bookFormat from a raw binding string ("Hardcover", "Mass
 *  Market Paperback", ...). Undefined when unknown — omit rather than guess. */
function schemaBookFormat(binding: string | null | undefined): string | undefined {
  if (!binding) return undefined
  const b = binding.toLowerCase()
  if (b.includes('hardcover') || b.includes('hardback')) return 'https://schema.org/Hardcover'
  if (b.includes('paperback') || b.includes('softcover') || b.includes('mass market')) return 'https://schema.org/Paperback'
  if (b.includes('audio')) return 'https://schema.org/AudiobookFormat'
  return undefined
}

/** Render a description as paragraphs. Descriptions arrive with \n breaks
 *  from the cleanup pipeline; single blob fallback if none. */
function DescriptionParagraphs({ text, fontSize = 14 }: { text: string; fontSize?: number }) {
  const paragraphs = text.split(/\n{2,}|\n/).map(p => p.trim()).filter(p => p.length > 0)
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} style={{ fontSize, color: 'var(--color-ink-soft)', lineHeight: 1.7, marginBottom: i === paragraphs.length - 1 ? 0 : 10 }}>
          {p}
        </p>
      ))}
    </>
  )
}

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const book = await findBookBySlug(slug)

  if (!book) return { title: 'Book not found — Sell Your Shelf' }

  const { data: listings } = await supabase
    .from('listings')
    .select('asking_price_gbp')
    .eq('book_id', book.id)
    .eq('status', 'active')

  const listingCount = listings?.length ?? 0

  // Meta description: availability + a hook from the real synopsis reads far
  // better in a SERP than boilerplate alone, and dedupes pages from Google's
  // point of view. Out-of-stock pages stay live (and indexed) — sold copies
  // shouldn't erase the page's accumulated ranking; a restock revives it
  // instantly.
  const descHook = book.description
    ? ` ${String(book.description).replace(/\s+/g, ' ').slice(0, 110).trim()}…`
    : ' Free shipping.'
  const lowestPrice = listingCount > 0
    ? Math.min(...listings!.map(l => Number(l.asking_price_gbp))).toFixed(2)
    : null
  const title = lowestPrice
    ? `Buy ${book.title} by ${book.author} | Used from £${lowestPrice}`
    : `${book.title} by ${book.author} | Sell Your Shelf`
  const description = lowestPrice
    ? `${listingCount} used cop${listingCount === 1 ? 'y' : 'ies'} from £${lowestPrice} on Sell Your Shelf.${descHook}`
    : `Currently out of stock — sellers list new copies daily. Have this book? Sell it on Sell Your Shelf.${descHook}`

  return {
    title,
    description,
    alternates: { canonical: `/books/${slug}` },
    // No `images` here on purpose: Next only falls back to the
    // opengraph-image route when openGraph.images is absent, and that
    // route composes the cover into a 1200×630 card instead of handing
    // share clients a bare portrait cover to crop.
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params
  const book = await findBookBySlug(slug)

  if (!book) return notFound()

  const { data: listingRows } = await supabase
    .from('listings')
    .select('id, user_id, asking_price_gbp, condition, notes, users!inner(username, location, deleted_at)')
    .eq('book_id', book.id)
    .eq('status', 'active')
    .is('users.deleted_at', null)
    .order('asking_price_gbp', { ascending: true })

  // Out-of-stock pages stay live: 404ing a book the moment its last copy
  // sells discards the page's search equity — the exact pages that rank
  // well enough to sell are the ones that vanish. With no copies we render
  // an out-of-stock state and drop the offers schema instead.
  const listings = listingRows ?? []
  const inStock = listings.length > 0

  const lowestPrice = inStock ? Number(listings[0].asking_price_gbp).toFixed(2) : null
  const highestPrice = inStock ? Number(listings[listings.length - 1].asking_price_gbp).toFixed(2) : null

  // Edition facts from the ISBNdb enrichment pipeline (book_metadata):
  // binding/pages/publisher/year/language. Prefer the seller-selected
  // edition row, fall back to any enriched row.
  const { data: editionMeta } = await supabase
    .from('book_metadata')
    .select('binding, page_count, publisher, published_date, language, isbn_13')
    .eq('book_id', book.id)
    .order('is_selected', { ascending: false })
    .limit(1)
    .maybeSingle()

  const cover = book.cover_url_hosted || book.cover_url
  const isbn13 = editionMeta?.isbn_13 || book.isbn || null
  const publishedYear = editionMeta?.published_date?.match(/\d{4}/)?.[0] ?? null
  const bookFormat = schemaBookFormat(editionMeta?.binding)
  const canonicalUrl = `https://www.sellyourshelf.com/books/${slug}`

  // Rich Book entity: image/description/edition facts are what qualify the
  // page for book + price rich results on the specific-title searches that
  // convert. Every field is omitted (not nulled) when unknown.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    author: { '@type': 'Person', name: book.author },
    url: canonicalUrl,
    ...(cover ? { image: cover } : {}),
    ...(book.description ? { description: String(book.description).slice(0, 5000) } : {}),
    ...(isbn13 ? { isbn: isbn13 } : {}),
    ...(bookFormat ? { bookFormat } : {}),
    ...(editionMeta?.page_count ? { numberOfPages: editionMeta.page_count } : {}),
    ...(editionMeta?.publisher ? { publisher: { '@type': 'Organization', name: editionMeta.publisher } } : {}),
    ...(publishedYear ? { datePublished: publishedYear } : {}),
    ...(editionMeta?.language ? { inLanguage: editionMeta.language } : {}),
    ...(inStock
      ? {
          offers: {
            '@type': 'AggregateOffer',
            lowPrice: lowestPrice,
            highPrice: highestPrice,
            priceCurrency: 'GBP',
            offerCount: String(listings.length),
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/UsedCondition',
            shippingDetails: offerShippingDetails(Number(lowestPrice)),
            hasMerchantReturnPolicy: merchantReturnPolicy,
            url: canonicalUrl,
          },
        }
      : {}),
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.sellyourshelf.com' },
      { '@type': 'ListItem', position: 2, name: 'Browse', item: 'https://www.sellyourshelf.com/new' },
      { '@type': 'ListItem', position: 3, name: book.title, item: canonicalUrl },
    ],
  }

  return (
    <div className="sy-page">

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <BookViewTracker bookId={book.id} slug={slug} />

      <SiteNav />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 32px 64px' }}>

        {/* Where you are, and what you can do with this page. */}
        <div className="sy-pagebar">
          <div className="sy-crumbs">
            <Link href="/">Home</Link>
            <span className="sy-crumb-sep">/</span>
            <Link href="/new">Browse</Link>
            <span className="sy-crumb-sep">/</span>
            {/* Last crumb, so it can't drop — it truncates instead. */}
            <span className="sy-crumb-here sy-crumb-clip">{book.title}</span>
          </div>
          <ShareButton
            url={`https://www.sellyourshelf.com/books/${slug}`}
            title={book.title}
            kind="book"
            compact
          />
        </div>

        {/* Book header */}
        <div className="sy-listing-split">
          <div>
            <div className="sy-cover">
              {(book.cover_url_hosted || book.cover_url) ? (
                <img src={book.cover_url_hosted || book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.95)', fontSize: 12, padding: 10, textAlign: 'center' }}>{book.title}</span>
                </div>
              )}
            </div>
            {(book.cover_url_hosted || book.cover_url) && (
              <p style={{ fontSize: 12, color: 'var(--color-ink-faint)', marginTop: 8, lineHeight: 1.4 }}>
                Cover image is for illustration. Actual edition may vary.
              </p>
            )}
          </div>

          <div>
            <h1 className="sy-h2" style={{ marginBottom: 8 }}>
              {book.title}
            </h1>
            {book.author && (
              <p style={{ fontSize: 16, color: 'var(--color-ink-soft)', marginBottom: 14 }}>
                {book.author}
              </p>
            )}

            {(editionMeta?.binding || editionMeta?.page_count || editionMeta?.publisher || publishedYear || isbn13) && (
              <dl className="sy-editiontable">
                {editionMeta?.binding && (
                  <div><dt>Format</dt><dd style={{ textTransform: 'capitalize' }}>{editionMeta.binding}</dd></div>
                )}
                {editionMeta?.publisher && (
                  <div>
                    <dt>Publisher</dt>
                    <dd>{editionMeta.publisher}{publishedYear ? `, ${publishedYear}` : ''}</dd>
                  </div>
                )}
                {editionMeta?.page_count && (
                  <div><dt>Pages</dt><dd className="sy-figure">{editionMeta.page_count}</dd></div>
                )}
                {isbn13 && (
                  <div><dt>ISBN</dt><dd className="sy-figure sy-isbn">{isbn13}</dd></div>
                )}
              </dl>
            )}

            <p style={{ fontSize: 14, color: 'var(--color-ink-soft)' }}>
              {inStock
                ? `${listings.length} ${listings.length === 1 ? 'copy' : 'copies'} available`
                : 'Currently out of stock'}
            </p>
          </div>
        </div>

        {/* Full description — rendered complete (no truncation) so both
            readers and crawlers get the whole synopsis, in paragraphs. */}
        {book.description && (
          <div style={{ marginBottom: 40 }}>
            <h2 className="sy-h3" style={{ marginBottom: 16, borderBottom: '1px solid var(--color-rule)', paddingBottom: 14 }}>
              About this book
            </h2>
            <DescriptionParagraphs text={String(book.description)} fontSize={14} />
          </div>
        )}

        {/* Available copies */}
        <div style={{ marginBottom: 40 }}>
          <h2 className="sy-h3" style={{ marginBottom: 20, borderBottom: '1px solid var(--color-rule)', paddingBottom: 14 }}>
            Available Copies
          </h2>

          {!inStock && (
            <div className="sy-panel" style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p className="sy-h3" style={{ marginBottom: 8 }}>
                No copies available right now
              </p>
              <p style={{ fontSize: 15, color: 'var(--color-ink-soft)', marginBottom: 20, lineHeight: 1.6 }}>
                Sellers list new books every day — check back soon. Or if you have a copy,
                scan it with the app and it could be listed in 90 seconds.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Link href="/new" className="sy-cta sy-cta-solid">
                  Browse available books
                </Link>
                {book.category && (
                  <Link href={`/category/${String(book.category).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="sy-cta sy-cta-quiet">
                    More {book.category}
                  </Link>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {listings.map((listing: any) => {
              const condColor = CONDITION_COLORS[listing.condition] ?? CONDITION_COLORS.acceptable
              const username = (listing.users as any)?.username

              return (
                <div
                  key={listing.id}
                  style={{
                    background: 'var(--color-sheet)',
                    border: '1px solid var(--color-rule)',
                    borderRadius: 'var(--radius-md)',
                    padding: '18px 22px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <ConditionMarker condition={listing.condition} />
                    {username && (
                      <Link href={`/${username}`} style={{ fontSize: 13, color: 'var(--color-action)', textDecoration: 'none' }}>
                        @{username}
                      </Link>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Price value={Number(listing.asking_price_gbp)} large />
                    <BuyNowLink
                      listingId={listing.id}
                      sellerId={(listing as { user_id?: string | null }).user_id ?? null}
                      style={{
                        background: 'var(--color-action)',
                        color: '#fff',
                        fontSize: 15,
                        fontWeight: 600,
                        padding: '13px 26px',
                        borderRadius: 'var(--radius-pill)',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Buy Now →
                    </BuyNowLink>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sell CTA */}
        <div style={{ background: 'var(--color-ground)', borderRadius: 'var(--radius-md)', padding: '40px 24px', textAlign: 'center' }}>
          <p className="sy-h3" style={{ color: 'var(--color-on-ground)', marginBottom: 8 }}>
            Sell your copy of {book.title}
          </p>
          <p style={{ color: 'var(--color-on-ground-soft)', fontSize: 15, marginBottom: 24 }}>
            List it in seconds with the Sell Your Shelf app
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <AppBadges
              utm={{ source: 'book_page', medium: 'footer', campaign: 'sell_your_copy' }}
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
