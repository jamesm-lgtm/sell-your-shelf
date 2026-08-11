import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import AppBadges from '@/app/components/AppBadges'
import BuyNowLink from '@/app/components/BuyNowLink'
import BookViewTracker from '@/app/components/BookViewTracker'
import { offerShippingDetails, merchantReturnPolicy } from '@/app/lib/offerSchema'

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
        <p key={i} style={{ fontSize, color: '#444', lineHeight: 1.7, marginBottom: i === paragraphs.length - 1 ? 0 : 10 }}>
          {p}
        </p>
      ))}
    </>
  )
}

function generateSlug(title: string, author: string): string {
  return `${title}-${author}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function findBookBySlug(slug: string) {
  const bookFields = 'id, title, author, title_normalized, author_normalized, cover_url, cover_url_hosted, description, isbn, category'

  // Primary: direct slug column lookup (requires migration)
  const { data: directMatch } = await supabase
    .from('books')
    .select(bookFields)
    .eq('slug', slug)
    .limit(1)
    .single()

  if (directMatch) return directMatch

  // Fallback: fuzzy search for pre-migration compatibility
  const words = slug.split('-').filter(w => w.length > 2)
  if (words.length === 0) return null

  const fuzzyWord = (w: string) => w.replace(/s$/, '')
  const firstWord = fuzzyWord(words[0])
  const lastWord = fuzzyWord(words[words.length - 1])

  const matchSlug = (b: any) => {
    const bookSlug = generateSlug(
      b.title_normalized || b.title,
      b.author_normalized || b.author || ''
    )
    return bookSlug === slug
  }

  const { data: candidates } = await supabase
    .from('books')
    .select(bookFields)
    .ilike('title_normalized', `%${firstWord}%`)
    .ilike('author_normalized', `%${lastWord}%`)
    .limit(100)

  const match1 = candidates?.find(matchSlug)
  if (match1) return match1

  const { data: fallback } = await supabase
    .from('books')
    .select(bookFields)
    .ilike('title_normalized', `%${firstWord}%`)
    .limit(200)

  return fallback?.find(matchSlug) ?? null
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

  if (!listings || listings.length === 0) return { title: 'Book not found — Sell Your Shelf' }

  const lowestPrice = Math.min(...listings.map(l => Number(l.asking_price_gbp))).toFixed(2)
  const listingCount = listings.length

  // Meta description: availability + a hook from the real synopsis reads far
  // better in a SERP than boilerplate alone, and dedupes pages from Google's
  // point of view.
  const descHook = book.description
    ? ` ${String(book.description).replace(/\s+/g, ' ').slice(0, 110).trim()}…`
    : ' Free shipping.'
  const title = `Buy ${book.title} by ${book.author} | Used from £${lowestPrice}`
  const description = `${listingCount} used cop${listingCount === 1 ? 'y' : 'ies'} from £${lowestPrice} on Sell Your Shelf.${descHook}`

  return {
    title,
    description,
    alternates: { canonical: `/books/${slug}` },
    openGraph: {
      title,
      description,
      type: 'website',
      images: [book.cover_url_hosted || book.cover_url || '/og-default.png'],
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params
  const book = await findBookBySlug(slug)

  if (!book) return notFound()

  const { data: listings } = await supabase
    .from('listings')
    .select('id, user_id, asking_price_gbp, condition, notes, users!inner(username, location, deleted_at)')
    .eq('book_id', book.id)
    .eq('status', 'active')
    .is('users.deleted_at', null)
    .order('asking_price_gbp', { ascending: true })

  if (!listings || listings.length === 0) return notFound()

  const lowestPrice = Number(listings[0].asking_price_gbp).toFixed(2)
  const highestPrice = Number(listings[listings.length - 1].asking_price_gbp).toFixed(2)

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
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

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

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>

        {/* Breadcrumbs */}
        <div style={{ fontSize: 12, color: '#999', marginBottom: 20, display: 'flex', gap: 6, alignItems: 'center' }}>
          <Link href="/" style={{ color: '#999', textDecoration: 'none' }}>Home</Link>
          <span style={{ color: '#ccc' }}>/</span>
          <Link href="/new" style={{ color: '#999', textDecoration: 'none' }}>Browse</Link>
          <span style={{ color: '#ccc' }}>/</span>
          <span style={{ color: '#666' }}>{book.title}</span>
        </div>

        {/* Book header */}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 32, alignItems: 'start', marginBottom: 40 }}>
          <div>
            <div style={{ borderRadius: 10, overflow: 'hidden', background: '#2D4A3E', aspectRatio: '2/3' }}>
              {(book.cover_url_hosted || book.cover_url) ? (
                <img src={book.cover_url_hosted || book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, padding: 8, textAlign: 'center' }}>{book.title}</span>
                </div>
              )}
            </div>
            {(book.cover_url_hosted || book.cover_url) && (
              <p style={{ fontSize: 10, color: '#999', marginTop: 6, lineHeight: 1.4 }}>
                Cover image is for illustration. Actual edition may vary.
              </p>
            )}
          </div>

          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3, marginBottom: 6 }}>
              {book.title}
            </h1>
            {book.author && (
              <p style={{ fontSize: 15, color: '#666', marginBottom: 12 }}>
                {book.author}
              </p>
            )}

            {(editionMeta?.binding || editionMeta?.page_count || editionMeta?.publisher || publishedYear || isbn13) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {editionMeta?.binding && (
                  <span style={{ fontSize: 11, color: '#666', background: '#F0EDE8', padding: '3px 8px', borderRadius: 4 }}>
                    {editionMeta.binding}
                  </span>
                )}
                {editionMeta?.page_count && (
                  <span style={{ fontSize: 11, color: '#666', background: '#F0EDE8', padding: '3px 8px', borderRadius: 4 }}>
                    {editionMeta.page_count} pages
                  </span>
                )}
                {editionMeta?.publisher && (
                  <span style={{ fontSize: 11, color: '#666', background: '#F0EDE8', padding: '3px 8px', borderRadius: 4 }}>
                    {editionMeta.publisher}{publishedYear ? `, ${publishedYear}` : ''}
                  </span>
                )}
                {isbn13 && (
                  <span style={{ fontSize: 11, color: '#666', background: '#F0EDE8', padding: '3px 8px', borderRadius: 4 }}>
                    ISBN: {isbn13}
                  </span>
                )}
              </div>
            )}

            <p style={{ fontSize: 14, color: '#666' }}>
              {listings.length} {listings.length === 1 ? 'copy' : 'copies'} available
            </p>
          </div>
        </div>

        {/* Full description — rendered complete (no truncation) so both
            readers and crawlers get the whole synopsis, in paragraphs. */}
        {book.description && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', marginBottom: 12, borderBottom: '0.5px solid #E5E3DF', paddingBottom: 12 }}>
              About this book
            </h2>
            <DescriptionParagraphs text={String(book.description)} fontSize={14} />
          </div>
        )}

        {/* Available copies */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', marginBottom: 16, borderBottom: '0.5px solid #E5E3DF', paddingBottom: 12 }}>
            Available Copies
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {listings.map((listing: any) => {
              const condColor = CONDITION_COLORS[listing.condition] ?? CONDITION_COLORS.acceptable
              const username = (listing.users as any)?.username

              return (
                <div
                  key={listing.id}
                  style={{
                    background: '#fff',
                    border: '0.5px solid #E5E3DF',
                    borderRadius: 10,
                    padding: '16px 20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 500,
                      padding: '4px 10px',
                      borderRadius: 4,
                      background: condColor.bg,
                      color: condColor.text,
                      whiteSpace: 'nowrap',
                    }}>
                      {CONDITIONS[listing.condition] ?? listing.condition}
                    </span>
                    {username && (
                      <Link href={`/${username}`} style={{ fontSize: 13, color: '#2D4A3E', textDecoration: 'none' }}>
                        @{username}
                      </Link>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 20, fontWeight: 600, color: '#2D4A3E' }}>
                      £{Number(listing.asking_price_gbp).toFixed(2)}
                    </span>
                    <BuyNowLink
                      listingId={listing.id}
                      sellerId={(listing as { user_id?: string | null }).user_id ?? null}
                      style={{
                        background: '#2D4A3E',
                        color: '#FAF8F5',
                        fontSize: 13,
                        fontWeight: 500,
                        padding: '10px 24px',
                        borderRadius: 6,
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
        <div style={{ background: '#2D4A3E', borderRadius: 12, padding: '24px', textAlign: 'center' }}>
          <p style={{ color: '#FAF8F5', fontSize: 16, fontWeight: 500, marginBottom: 6 }}>
            Sell your copy of {book.title}
          </p>
          <p style={{ color: 'rgba(250,248,245,0.7)', fontSize: 13, marginBottom: 20 }}>
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
