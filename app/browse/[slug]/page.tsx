import { notFound } from 'next/navigation'
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
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params

  const { data: tag } = await supabase
    .from('editorial_tags')
    .select('label')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!tag) return { title: 'Not found — Sell Your Shelf' }

  return {
    title: `${tag.label} — Sell Your Shelf`,
    description: `Browse ${tag.label.toLowerCase()} books on Sell Your Shelf. Curated picks with secure payments and tracked shipping.`,
    openGraph: {
      title: `${tag.label} — Sell Your Shelf`,
      description: `Curated ${tag.label.toLowerCase()} books from UK sellers`,
      url: `https://www.sellyourshelf.com/browse/${slug}`,
    },
  }
}

export default async function BrowseTagPage({ params }: Props) {
  const { slug } = await params

  let { data: tag, error: tagError } = await supabase
    .from('editorial_tags')
    .select('id, label, slug, description')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  // Fall back if description column doesn't exist yet
  if (tagError) {
    const fallback = await supabase
      .from('editorial_tags')
      .select('id, label, slug')
      .eq('slug', slug)
      .eq('active', true)
      .single()
    tag = fallback.data ? { ...fallback.data, description: '' } : null
  }

  if (!tag) return notFound()

  // Get all listing IDs tagged with this editorial tag
  const { data: taggedEntries } = await supabase
    .from('listing_editorial_tags')
    .select('listing_id')
    .eq('tag_id', tag.id)

  if (!taggedEntries || taggedEntries.length === 0) return notFound()

  const listingIds = taggedEntries.map(e => e.listing_id)

  // Fetch the actual listings
  const { data: listings } = await supabase
    .from('listings')
    .select(`
      id, title, author, asking_price_gbp, condition,
      books(cover_url),
      users!inner(username, deleted_at)
    `)
    .eq('status', 'active')
    .is('users.deleted_at', null)
    .in('id', listingIds)
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

  if (safeListings.length === 0) return notFound()

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <SiteNav current="browse" />

      <div style={{ borderBottom: '0.5px solid #E5E3DF', padding: '32px 24px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto' }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link href="/" style={{ color: '#999', textDecoration: 'none' }}>Home</Link>
            <span style={{ color: '#ccc' }}>/</span>
            <Link href="/new" style={{ color: '#999', textDecoration: 'none' }}>Browse</Link>
            <span style={{ color: '#ccc' }}>/</span>
            <span style={{ color: '#666' }}>{tag.label}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>
            {tag.label}
          </div>
          {tag.description && (
            <div style={{ fontSize: 14, color: '#666', marginBottom: 4, lineHeight: 1.4 }}>
              {tag.description}
            </div>
          )}
          <div style={{ fontSize: 14, color: '#666' }}>
            {safeListings.length} {safeListings.length === 1 ? 'book' : 'books'} available
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
