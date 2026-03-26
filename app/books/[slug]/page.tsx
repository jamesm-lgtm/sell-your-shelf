import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

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

function generateSlug(title: string, author: string): string {
  return `${title}-${author}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function findBookBySlug(slug: string) {
  const words = slug.split('-').filter(w => w.length > 2)
  if (words.length === 0) return null

  const bookFields = 'id, title, author, title_normalized, author_normalized, cover_url, description, isbn'

  // Trim trailing 's' from search words to handle apostrophe cases
  // e.g. "hunters" in slug should match "hunter's" in DB
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

  // Try: first word in title AND last word in author
  const { data: candidates } = await supabase
    .from('books')
    .select(bookFields)
    .ilike('title_normalized', `%${firstWord}%`)
    .ilike('author_normalized', `%${lastWord}%`)
    .limit(100)

  const match1 = candidates?.find(matchSlug)
  if (match1) return match1

  // Fallback: just first word in title (broader)
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

  return {
    title: `Buy ${book.title} by ${book.author} | Sell Your Shelf`,
    description: `${listingCount} used cop${listingCount === 1 ? 'y' : 'ies'} of ${book.title} from £${lowestPrice}. Free shipping.`,
    openGraph: {
      images: [book.cover_url || '/og-default.png'],
    },
  }
}

export default async function BookPage({ params }: Props) {
  const { slug } = await params
  const book = await findBookBySlug(slug)

  if (!book) return notFound()

  const { data: listings } = await supabase
    .from('listings')
    .select('id, asking_price_gbp, condition, notes, users(username, location)')
    .eq('book_id', book.id)
    .eq('status', 'active')
    .order('asking_price_gbp', { ascending: true })

  if (!listings || listings.length === 0) return notFound()

  const lowestPrice = Number(listings[0].asking_price_gbp).toFixed(2)
  const highestPrice = Number(listings[listings.length - 1].asking_price_gbp).toFixed(2)

  const APP_STORE_URL = 'https://apps.apple.com/gb/app/sell-your-shelf/id6739630632?utm_source=book_page&utm_medium=web&utm_campaign=sell_cta'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    author: { '@type': 'Person', name: book.author },
    ...(book.isbn ? { isbn: book.isbn } : {}),
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: lowestPrice,
      highPrice: highestPrice,
      priceCurrency: 'GBP',
      offerCount: String(listings.length),
    },
  }

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav style={{ background: '#2D4A3E', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: '#FAF8F5', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
          Sell Your Shelf
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/new" style={{ color: 'rgba(250,248,245,0.8)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            Browse
          </Link>
          <Link href="/support" style={{ color: 'rgba(250,248,245,0.8)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            Support
          </Link>
          <a href="https://apps.apple.com/gb/app/sell-your-shelf/id6739630632" style={{ background: '#FAF8F5', color: '#2D4A3E', fontSize: 13, fontWeight: 500, padding: '7px 16px', borderRadius: 6, textDecoration: 'none' }}>
            Get the app
          </a>
        </div>
      </nav>

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
          <div style={{ borderRadius: 10, overflow: 'hidden', background: '#2D4A3E', aspectRatio: '2/3' }}>
            {book.cover_url ? (
              <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, padding: 8, textAlign: 'center' }}>{book.title}</span>
              </div>
            )}
          </div>

          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3, marginBottom: 6 }}>
              {book.title}
            </h1>
            {book.author && (
              <p style={{ fontSize: 15, color: '#666', marginBottom: 16 }}>
                {book.author}
              </p>
            )}

            {book.description && (
              <p style={{ fontSize: 13, color: '#444', lineHeight: 1.6, marginBottom: 16 }}>
                {book.description.length > 300 ? book.description.slice(0, 300) + '...' : book.description}
              </p>
            )}

            <p style={{ fontSize: 14, color: '#666' }}>
              {listings.length} {listings.length === 1 ? 'copy' : 'copies'} available
            </p>
          </div>
        </div>

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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 18, fontWeight: 600, color: '#2D4A3E' }}>
                      £{Number(listing.asking_price_gbp).toFixed(2)}
                    </span>
                    <Link
                      href={`/checkout/${listing.id}`}
                      style={{
                        background: '#2D4A3E',
                        color: '#FAF8F5',
                        fontSize: 13,
                        fontWeight: 500,
                        padding: '9px 20px',
                        borderRadius: 6,
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Buy Now →
                    </Link>
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
          <a
            href={APP_STORE_URL}
            style={{ display: 'inline-block', background: '#FAF8F5', color: '#2D4A3E', fontSize: 14, fontWeight: 600, padding: '12px 32px', borderRadius: 8, textDecoration: 'none' }}
          >
            Download on the App Store
          </a>
        </div>

      </div>

      <footer style={{ borderTop: '0.5px solid #E5E3DF', padding: '24px', textAlign: 'center', marginTop: 40 }}>
        <Link href="/" style={{ fontSize: 13, color: '#999', textDecoration: 'none' }}>
          ← Back to Sell Your Shelf
        </Link>
      </footer>

    </div>
  )
}
