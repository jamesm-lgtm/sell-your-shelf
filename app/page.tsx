import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import AppBadges from '@/app/components/AppBadges'
import CuratedRows from '@/app/components/CuratedRows'
import { getCuratedRows } from '@/app/lib/editorial'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const CATEGORY_LINKS = [
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
]

function generateSlug(title: string, author: string): string {
  return `${title}-${author}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default async function Home() {
  // Fetch popular books (books with most listings)
  const { data: popularBooks } = await supabase
    .from('books')
    .select('id, title, author, title_normalized, author_normalized, cover_url, cover_url_hosted, slug, category')
    .not('cover_url', 'is', null)
    .not('title_normalized', 'is', null)
    .not('author_normalized', 'is', null)
    .limit(500)

  // Find books that have active listings and pick ones with covers
  let featuredBooks: Array<{ title: string; author: string; cover_url: string; slug: string }> = []
  if (popularBooks) {
    const { data: activeCounts } = await supabase
      .from('listings')
      .select('book_id')
      .eq('status', 'active')
      .not('book_id', 'is', null)

    if (activeCounts) {
      const countMap = new Map<number, number>()
      activeCounts.forEach((l: any) => {
        countMap.set(l.book_id, (countMap.get(l.book_id) || 0) + 1)
      })

      featuredBooks = popularBooks
        .filter(b => countMap.has(b.id) && (b.cover_url_hosted || b.cover_url))
        .sort((a, b) => (countMap.get(b.id) || 0) - (countMap.get(a.id) || 0))
        .slice(0, 8)
        .map(b => ({
          title: b.title,
          author: b.author || '',
          cover_url: b.cover_url_hosted || b.cover_url!,
          slug: b.slug || generateSlug(b.title_normalized || b.title, b.author_normalized || b.author || ''),
        }))
    }
  }

  const { data: recentListings } = await supabase
    .from('listings')
    .select('id, title, author, asking_price_gbp, books(cover_url, cover_url_hosted)')
    .eq('status', 'active')
    .not('book_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(40)

  const withCovers = (recentListings as any[])?.filter(
    (l: any) => l.books?.cover_url_hosted || l.books?.cover_url
  ) ?? []

  const curatedRows = await getCuratedRows()

  const ticker = [...withCovers, ...withCovers, ...withCovers]

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#FAF8F5' }}>

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-100% / 3)); }
        }
        .ticker-track {
          display: flex;
          gap: 12px;
          animation: ticker 60s linear infinite;
          width: max-content;
          will-change: transform;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <SiteNav />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium mb-6" style={{ backgroundColor: 'rgba(45, 74, 62, 0.1)', color: '#2D4A3E', border: '1px solid rgba(45, 74, 62, 0.2)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#2D4A3E' }}></span>
              Now on iOS and Android
            </div>

            <h1 className="text-5xl lg:text-6xl text-gray-900 leading-tight tracking-tight mb-6" style={{ fontFamily: 'Georgia, serif' }}>
              Your books deserve<br />
              <span style={{ color: '#2D4A3E' }}>better than boxes</span>
            </h1>

            <p className="text-xl text-gray-500 leading-relaxed mb-10 max-w-lg">
              Scan your entire bookshelf in 90 seconds. Our AI identifies each title, prices it fairly, and connects you with readers who&apos;ll actually treasure them.
            </p>

            <div className="mb-8">
              <AppBadges
                utm={{ source: 'homepage', medium: 'hero', campaign: 'get_the_app' }}
                size="lg"
                layout="auto"
              />
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" style={{ color: '#2D4A3E' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
                Secure payments
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" style={{ color: '#2D4A3E' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Keep £4–6 per book
              </span>
            </div>
          </div>

          {/* Phone Mockup */}
          <div className="relative flex justify-center">
            <div className="absolute inset-0 rounded-3xl rotate-3 scale-95" style={{ background: 'linear-gradient(135deg, rgba(45,74,62,0.1) 0%, rgba(45,74,62,0.05) 100%)' }}></div>
            <div className="relative bg-gray-900 rounded-[40px] p-3 shadow-2xl max-w-[280px]">
              <div className="rounded-[32px] aspect-[9/16] overflow-hidden" style={{ backgroundColor: '#FAF8F5' }}>
                <div className="px-5 py-4 bg-white" style={{ borderBottom: '1px solid #F0EDE8' }}>
                  <p className="text-sm font-semibold text-center text-gray-900">Your Books</p>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { title: 'Atomic Habits', author: 'James Clear', price: '£6.50', bg: '#2D4A3E' },
                    { title: 'The Psychology of Money', author: 'Morgan Housel', price: '£5.75', bg: '#92400e' },
                    { title: 'Deep Work', author: 'Cal Newport', price: '£4.25', bg: '#334155' },
                  ].map((book, i) => (
                    <div key={i} className="bg-white rounded-xl p-3 flex gap-3" style={{ border: '1px solid #F0EDE8' }}>
                      <div className="w-11 h-16 rounded flex-shrink-0" style={{ backgroundColor: book.bg }}></div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{book.title}</p>
                        <p className="text-gray-500 mb-2" style={{ fontSize: '11px' }}>{book.author}</p>
                        <p className="text-sm font-bold" style={{ color: '#2D4A3E' }}>{book.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Listings Ticker */}
      {ticker.length > 0 && (
        <div style={{ borderTop: '1px solid #E5E3DF', borderBottom: '1px solid #E5E3DF', backgroundColor: '#fff', padding: '24px 0', overflow: 'hidden' }}>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#999', marginBottom: 16, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Recently listed
          </p>
          <div style={{ overflow: 'hidden' }}>
            <div className="ticker-track">
              {ticker.map((listing: any, i: number) => (
                <Link
                  key={i}
                  href={`/listing/${listing.id}`}
                  style={{ flexShrink: 0, display: 'block', textDecoration: 'none' }}
                >
                  <div style={{ width: 80, borderRadius: 8, overflow: 'hidden', background: '#2D4A3E' }}>
                    <div style={{ aspectRatio: '2/3' }}>
                      <img
                        src={listing.books.cover_url_hosted || listing.books.cover_url}
                        alt={listing.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: '#666', marginTop: 6, width: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    £{Number(listing.asking_price_gbp).toFixed(2)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Curated Editorial Rows */}
      <CuratedRows rows={curatedRows} />

      {/* Browse by Category */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl text-gray-900 mb-3" style={{ fontFamily: 'Georgia, serif' }}>Browse by category</h2>
            <p className="text-gray-500">Find your next read from UK sellers</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {CATEGORY_LINKS.map(cat => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="text-sm font-medium px-5 py-2.5 rounded-full border transition-colors text-gray-900 border-gray-200 hover:bg-gray-900 hover:text-white hover:border-gray-900"
              >
                {cat.name}
              </Link>
            ))}
            <Link
              href="/new"
              className="text-sm font-medium px-5 py-2.5 rounded-full transition-colors"
              style={{ background: '#2D4A3E', color: '#FAF8F5' }}
            >
              View all →
            </Link>
          </div>
        </div>
      </section>

      {/* Popular Books */}
      {featuredBooks.length > 0 && (
        <section className="py-16 px-6" style={{ background: '#fff', borderTop: '1px solid #E5E3DF', borderBottom: '1px solid #E5E3DF' }}>
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-3xl text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Popular books</h2>
              <Link href="/new" className="text-sm font-medium hover:underline" style={{ color: '#2D4A3E' }}>
                Browse all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
              {featuredBooks.map((book, i) => (
                <Link key={i} href={`/books/${book.slug}`} className="group block">
                  <div className="rounded-lg overflow-hidden mb-2" style={{ aspectRatio: '2/3', background: '#2D4A3E' }}>
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <p className="text-xs font-medium text-gray-900 leading-tight line-clamp-2">{book.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{book.author}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section id="how-it-works" className="bg-white py-24 px-6" style={{ borderTop: '1px solid #E5E3DF', borderBottom: '1px solid #E5E3DF' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 max-w-xl mx-auto">
            <h2 className="text-4xl text-gray-900 mb-4" style={{ fontFamily: 'Georgia, serif' }}>From shelf to sold in three steps</h2>
            <p className="text-gray-500 text-lg">
              We&apos;ve stripped away everything that makes selling books tedious. No typing titles. No scanning barcodes. No guessing prices.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: '01',
                title: 'Scan your shelf',
                description: 'Pan your camera across your bookshelf. Our AI identifies every spine in real-time—typically 30 books in under 90 seconds.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              },
              {
                step: '02',
                title: 'Review & price',
                description: 'We check live market data and suggest fair prices. Accept our recommendations or adjust them—you\'re in control.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
              },
              {
                step: '03',
                title: 'Ship & get paid',
                description: 'When a book sells, generate your £2.50 shipping label and drop it at any Yodel drop-off point — no printer needed. Payment lands in your account once delivered.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
              }
            ].map((item, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(45, 74, 62, 0.1)', border: '1px solid rgba(45, 74, 62, 0.2)' }}>
                  <svg className="w-6 h-6" style={{ color: '#2D4A3E' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {item.icon}
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#2D4A3E' }}>Step {item.step}</p>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="max-w-4xl mx-auto py-24 px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl text-gray-900 mb-4" style={{ fontFamily: 'Georgia, serif' }}>Why settle for pennies?</h2>
          <p className="text-gray-500 text-lg">Trade-in services give you pocket change. We connect you directly with readers.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="rounded-2xl p-8" style={{ backgroundColor: '#F0EDE8', border: '1px solid #E5E3DF' }}>
            <p className="text-sm font-medium text-gray-500 mb-4">Trade-in services</p>
            <p className="text-5xl text-gray-400 mb-1" style={{ fontFamily: 'Georgia, serif' }}>~25p</p>
            <p className="text-gray-500">per book, if they accept it</p>
          </div>
          <div className="text-white rounded-2xl p-8 relative overflow-hidden" style={{ backgroundColor: '#2D4A3E' }}>
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-30" style={{ backgroundColor: '#3B5249' }}></div>
            <div className="relative">
              <p className="text-sm font-medium text-white/80 mb-4">Sell Your Shelf</p>
              <p className="text-5xl mb-1" style={{ fontFamily: 'Georgia, serif' }}>£4–6</p>
              <p className="text-white/80">per book, directly from readers</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <div className="py-8 px-6" style={{ backgroundColor: '#F0EDE8', borderTop: '1px solid #E5E3DF' }}>
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-12 text-sm text-gray-500">
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"/>
            </svg>
            Payments by Stripe
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            Buyer protection included
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
            UK registered company
          </span>
        </div>
      </div>

      <Footer />

    </main>
  )
}