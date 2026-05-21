import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import ShelfGrid from '@/app/components/ShelfGrid'
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

export default async function NewInPage() {
  const { data: listings } = await supabase
    .from('listings')
    .select(`
      id, title, author, asking_price_gbp, condition,
      books(cover_url, cover_url_hosted),
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
    users: { username: string } | null
  }>

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
            {safeListings.length} books available — updated in real time
          </div>
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

      <CuratedRows rows={curatedRows} />

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
        <ShelfGrid listings={safeListings} showSeller pageSize={24} />
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
