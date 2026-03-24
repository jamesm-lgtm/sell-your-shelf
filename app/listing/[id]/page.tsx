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

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params

  const { data } = await supabase
    .from('listings')
    .select('title, author, asking_price_gbp, books(cover_url)')
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (!data) return { title: 'Listing not found — Sell Your Shelf' }

  const cover = (data.books as any)?.cover_url

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
    .from('listings')
    .select(`
      id, title, author, asking_price_gbp, condition, notes,
      books(cover_url, description, category),
      users(username)
    `)
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (error || !listing) return notFound()

  const cover = (listing.books as any)?.cover_url
  const description = (listing.books as any)?.description
  const category = (listing.books as any)?.category
  const username = (listing.users as any)?.username
  const appStoreUrl = `https://apps.apple.com/gb/app/sell-your-shelf/id6739630632?utm_source=listing&utm_medium=web&utm_campaign=${id}`

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      {/* Deep link script — tries to open app, falls back to App Store */}
      <script dangerouslySetInnerHTML={{ __html: `
  (function() {
    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;
    var appUrl = 'sellyourshelf://listing/${listing.id}';
    var start = Date.now();
    window.location.href = appUrl;
    setTimeout(function() {
      if (Date.now() - start < 2500) {
        window.location.href = '${appStoreUrl}';
      }
    }, 2000);
  })();
`}} />

      <nav style={{ background: '#2D4A3E', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: '#FAF8F5', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
          Sell Your Shelf
        </Link>
        <a href={appStoreUrl} style={{ background: '#FAF8F5', color: '#2D4A3E', fontSize: 13, fontWeight: 500, padding: '7px 16px', borderRadius: 6, textDecoration: 'none' }}>
          Get the app
        </a>
      </nav>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 32, alignItems: 'start', marginBottom: 32 }}>
          <div style={{ borderRadius: 10, overflow: 'hidden', background: '#2D4A3E', aspectRatio: '2/3' }}>
            {cover ? (
              <img src={cover} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, padding: 8, textAlign: 'center' }}>{listing.title}</span>
              </div>
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
              <p style={{ fontSize: 15, color: '#666', marginBottom: 20 }}>
                {listing.author}
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 28, fontWeight: 600, color: '#2D4A3E' }}>
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
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 13, color: '#999', fontWeight: 500, marginBottom: 8 }}>About this book</p>
            <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7 }}>
              {description.length > 400 ? description.slice(0, 400) + '...' : description}
            </p>
          </div>
        )}

        <div style={{ background: '#2D4A3E', borderRadius: 12, padding: '24px', textAlign: 'center' }}>
          <p style={{ color: '#FAF8F5', fontSize: 16, fontWeight: 500, marginBottom: 6 }}>
            Buy this book on Sell Your Shelf
          </p>
          <p style={{ color: 'rgba(250,248,245,0.7)', fontSize: 13, marginBottom: 20 }}>
            Download the app to purchase — secure payments, tracked shipping
          </p>
          
          <a
            href={appStoreUrl}
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