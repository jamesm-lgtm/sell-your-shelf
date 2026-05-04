import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import ShelfGrid from '@/app/components/ShelfGrid'
import EventTracker from '@/app/components/EventTracker'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const CATEGORIES: Record<string, string> = {
  'fiction': 'Fiction',
  'childrens': "Children's",
  'biography-memoir': 'Biography & Memoir',
  'crime-thriller': 'Crime & Thriller',
  'self-help': 'Self-Help',
  'history': 'History',
  'reference-education': 'Reference & Education',
  'business-finance': 'Business & Finance',
  'literary-fiction': 'Literary Fiction',
  'travel': 'Travel',
  'cookery-food': 'Cookery & Food',
  'art-photography': 'Art & Photography',
  'science-nature': 'Science & Nature',
  'young-adult': 'Young Adult',
  'classic-fiction': 'Classic Fiction',
  'historical-fiction': 'Historical Fiction',
  'romance': 'Romance',
  'sci-fi-fantasy': 'Sci-Fi & Fantasy',
  'comics-graphic-novels': 'Comics & Graphic Novels',
}

function categoryToSlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/[']/g, '')
    .replace(/[&]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

type Props = {
  params: Promise<{ category: string }>
}

export async function generateMetadata({ params }: Props) {
  const { category } = await params
  const displayName = CATEGORIES[category]
  if (!displayName) return { title: 'Category not found — Sell Your Shelf' }

  return {
    title: `Buy ${displayName} Books — Sell Your Shelf`,
    description: `Browse secondhand ${displayName.toLowerCase()} books for sale on Sell Your Shelf. Secure payments, tracked shipping across the UK.`,
    openGraph: {
      title: `${displayName} Books — Sell Your Shelf`,
      description: `Secondhand ${displayName.toLowerCase()} books from UK sellers`,
      url: `https://www.sellyourshelf.com/category/${category}`,
    },
  }
}

export async function generateStaticParams() {
  return Object.keys(CATEGORIES).map(category => ({ category }))
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params
  const displayName = CATEGORIES[category]
  if (!displayName) return notFound()

  // Get books in this category that have active listings
  const { data: books } = await supabase
    .from('books')
    .select('id')
    .eq('category', displayName)
    .limit(500)

  if (!books || books.length === 0) return notFound()

  const bookIds = books.map(b => b.id)

  // Get active listings for these books
  const { data: listings } = await supabase
    .from('listings')
    .select(`
      id, title, author, asking_price_gbp, condition,
      books(cover_url, cover_url_hosted),
      users!inner(username, deleted_at)
    `)
    .eq('status', 'active')
    .is('users.deleted_at', null)
    .in('book_id', bookIds)
    .order('created_at', { ascending: false })
    .limit(200)

  const safeListings = (listings ?? []) as unknown as Array<{
    id: number
    title: string
    author: string | null
    asking_price_gbp: number
    condition: string
    books: { cover_url: string | null; cover_url_hosted?: string | null } | null
    users: { username: string } | null
  }>

  if (safeListings.length === 0) return notFound()

  // Get all categories for the sidebar
  const categoryEntries = Object.entries(CATEGORIES)

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
            <span style={{ color: '#666' }}>{displayName}</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>
            {displayName} Books
          </div>
          <div style={{ fontSize: 14, color: '#666' }}>
            {safeListings.length} {safeListings.length === 1 ? 'book' : 'books'} available
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div style={{ borderBottom: '0.5px solid #E5E3DF', padding: '12px 24px', overflow: 'auto' }}>
        <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', gap: 8, flexWrap: 'nowrap' }}>
          <Link
            href="/new"
            style={{
              fontSize: 12, padding: '6px 14px', borderRadius: 20, textDecoration: 'none', whiteSpace: 'nowrap',
              background: '#fff', color: '#666', border: '0.5px solid #E5E3DF',
            }}
          >
            All
          </Link>
          {categoryEntries.map(([slug, name]) => (
            <Link
              key={slug}
              href={`/category/${slug}`}
              style={{
                fontSize: 12, padding: '6px 14px', borderRadius: 20, textDecoration: 'none', whiteSpace: 'nowrap',
                background: slug === category ? '#2D4A3E' : '#fff',
                color: slug === category ? '#FAF8F5' : '#666',
                border: `0.5px solid ${slug === category ? '#2D4A3E' : '#E5E3DF'}`,
              }}
            >
              {name}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
        <ShelfGrid listings={safeListings} showSeller pageSize={24} />
      </div>

      <EventTracker eventName="category_view" properties={{ category_slug: category }} />

      <Footer />

    </div>
  )
}
