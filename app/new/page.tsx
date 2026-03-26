import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import ShelfGrid from '@/app/components/ShelfGrid'

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
      books(cover_url),
      users(username)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(200)

  const safeListings = (listings ?? []) as unknown as Array<{
    id: number
    title: string
    author: string | null
    asking_price_gbp: number
    condition: string
    books: { cover_url: string | null } | null
    users: { username: string } | null
  }>

  const APP_STORE_URL = 'https://apps.apple.com/gb/app/sell-your-shelf/id6739630632?utm_source=new&utm_medium=web'

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <nav style={{ background: '#2D4A3E', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: '#FAF8F5', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
          Sell Your Shelf
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/new" style={{ color: '#FAF8F5', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            Browse
          </Link>
          <Link href="/support" style={{ color: 'rgba(250,248,245,0.8)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            Support
          </Link>
          <a href={APP_STORE_URL} style={{ background: '#FAF8F5', color: '#2D4A3E', fontSize: 13, fontWeight: 500, padding: '7px 16px', borderRadius: 6, textDecoration: 'none' }}>
            Get the app
          </a>
        </div>
      </nav>

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

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
        <ShelfGrid listings={safeListings} showSeller pageSize={24} />
      </div>

      <div style={{ background: '#2D4A3E', padding: '16px 24px', marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ color: '#FAF8F5', fontSize: 14, fontWeight: 500 }}>
            Want to sell your books?
          </div>
          <div style={{ color: 'rgba(250,248,245,0.7)', fontSize: 12, marginTop: 2 }}>
            List 30 books in 90 seconds with AI shelf scanning
          </div>
        </div>
        <a href={APP_STORE_URL} style={{ background: '#FAF8F5', color: '#2D4A3E', fontSize: 13, fontWeight: 500, padding: '9px 20px', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Download the app
        </a>
      </div>

    </div>
  )
}
