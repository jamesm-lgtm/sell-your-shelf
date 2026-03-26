import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import ShelfGrid from '@/app/components/ShelfGrid'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ searchParams }: Props) {
  const params = await searchParams
  const q = (params.q as string) || ''
  return {
    title: q ? `"${q}" — Search — Sell Your Shelf` : 'Search — Sell Your Shelf',
    robots: { index: false },
  }
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams
  const q = ((params.q as string) || '').trim()

  let listings: any[] = []

  if (q.length > 0) {
    // Search by title and author using ilike
    const { data: titleResults } = await supabase
      .from('listings')
      .select(`
        id, title, author, asking_price_gbp, condition,
        books(cover_url),
        users(username)
      `)
      .eq('status', 'active')
      .ilike('title', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(100)

    const { data: authorResults } = await supabase
      .from('listings')
      .select(`
        id, title, author, asking_price_gbp, condition,
        books(cover_url),
        users(username)
      `)
      .eq('status', 'active')
      .ilike('author', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(100)

    // Merge and deduplicate
    const seen = new Set<number>()
    const merged: any[] = []
    for (const item of [...(titleResults ?? []), ...(authorResults ?? [])]) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        merged.push(item)
      }
    }
    listings = merged
  }

  const safeListings = listings as Array<{
    id: number
    title: string
    author: string | null
    asking_price_gbp: number
    condition: string
    books: { cover_url: string | null } | null
    users: { username: string } | null
  }>

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <SiteNav />

      <div style={{ borderBottom: '0.5px solid #E5E3DF', padding: '32px 24px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link href="/" style={{ color: '#999', textDecoration: 'none' }}>Home</Link>
            <span style={{ color: '#ccc' }}>/</span>
            <span style={{ color: '#666' }}>Search</span>
          </div>
          {q ? (
            <>
              <div style={{ fontSize: 24, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>
                Results for &ldquo;{q}&rdquo;
              </div>
              <div style={{ fontSize: 14, color: '#666' }}>
                {safeListings.length} {safeListings.length === 1 ? 'book' : 'books'} found
              </div>
            </>
          ) : (
            <div style={{ fontSize: 24, fontWeight: 500, color: '#1A1A1A' }}>
              Search
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
        {q.length === 0 ? (
          <p style={{ color: '#999', fontSize: 15, textAlign: 'center', paddingTop: 48 }}>
            Use the search bar above to find books by title or author.
          </p>
        ) : safeListings.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <p style={{ color: '#999', fontSize: 15, marginBottom: 16 }}>
              No books found for &ldquo;{q}&rdquo;
            </p>
            <Link href="/new" style={{ color: '#2D4A3E', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
              Browse all books →
            </Link>
          </div>
        ) : (
          <ShelfGrid listings={safeListings} showSeller pageSize={24} />
        )}
      </div>

      <Footer />

    </div>
  )
}
