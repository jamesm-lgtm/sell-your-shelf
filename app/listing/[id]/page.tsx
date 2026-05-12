import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import ListingViewTracker from '@/app/components/ListingViewTracker'
import AddToBasketButton from '@/app/components/AddToBasketButton'

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
    .select('title, author, asking_price_gbp, edition_cover, work_cover, edition_cover_hosted, work_cover_hosted')
    .eq('id', id)
    .single()

  if (!data) return { title: 'Listing not found — Sell Your Shelf' }

  const cover = data.edition_cover_hosted || data.edition_cover || data.work_cover_hosted || data.work_cover

  return {
    title: `${data.title} — Sell Your Shelf`,
    description: `${data.author ? `by ${data.author} — ` : ''}£${Number(data.asking_price_gbp).toFixed(2)} on Sell Your Shelf`,
    openGraph: {
      title: `${data.title} on Sell Your Shelf`,
      description: `${data.author ? `by ${data.author} — ` : ''}£${Number(data.asking_price_gbp).toFixed(2)}`,
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

  if (error || !listing) return notFound()

  // Check listing is still active (marketplace_listings is a view, double-check status)
  const { data: rawListing } = await supabase
    .from('listings')
    .select('status, user_id, format')
    .eq('id', id)
    .single()

  if (!rawListing || rawListing.status !== 'active') return notFound()

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
  const appStoreUrl = `https://apps.apple.com/gb/app/sell-your-shelf/id6739630632?utm_source=listing&utm_medium=web&utm_campaign=${id}`

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

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
            <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7 }}>
              {description.length > 400 ? description.slice(0, 400) + '...' : description}
            </p>
          </div>
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

        <div style={{ background: '#F0EDE8', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', marginBottom: 2 }}>
              Want to sell your books?
            </p>
            <p style={{ fontSize: 12, color: '#666' }}>
              List 30 books in 90 seconds with AI shelf scanning
            </p>
          </div>
          <a href={appStoreUrl}
            style={{ background: '#2D4A3E', color: '#FAF8F5', fontSize: 13, fontWeight: 500, padding: '9px 20px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Get the app
          </a>
        </div>

      </div>

      <ListingViewTracker listingId={Number(id)} />

      <Footer />

    </div>
  )
}