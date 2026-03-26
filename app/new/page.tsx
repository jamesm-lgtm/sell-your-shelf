import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import ShelfGrid from '@/app/components/ShelfGrid'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'

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

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
        <ShelfGrid listings={safeListings} showSeller pageSize={24} />
      </div>

      <Footer />

    </div>
  )
}
