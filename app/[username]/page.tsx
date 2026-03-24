import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import Link from 'next/link'
import ShelfGrid from '@/app/components/ShelfGrid'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

type Props = {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params

  const { data: user } = await supabase
    .from('users')
    .select('id, username')
    .eq('username', username)
    .single()

  if (!user) return { title: 'Shelf not found — Sell Your Shelf' }

  const { data: listings } = await supabase
    .from('listings')
    .select('asking_price_gbp, books(cover_url)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('asking_price_gbp', { ascending: true })

  const count = listings?.length ?? 0
  const fromPrice = listings?.[0]?.asking_price_gbp
    ? `£${Number(listings[0].asking_price_gbp).toFixed(2)}`
    : null
  const ogImage = (listings as any)?.find((l: any) => l.books?.cover_url)?.books?.cover_url
    ?? 'https://sellyourshelf.com/og-default.png'

  return {
    title: `@${user.username}'s shelf — Sell Your Shelf`,
    description: fromPrice ? `${count} books for sale from ${fromPrice}` : `${count} books for sale`,
    openGraph: {
      title: `@${user.username}'s shelf on Sell Your Shelf`,
      description: fromPrice ? `${count} books for sale from ${fromPrice} — shop the shelf` : `${count} books for sale`,
      images: [{ url: ogImage }],
      url: `https://sellyourshelf.com/@${user.username}`,
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function SellerShelfPage({ params }: Props) {
  const { username } = await params

  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, location')
    .eq('username', username)
    .single()

  if (error || !user || !user.username) return notFound()

  const { data: listings } = await supabase
    .from('listings')
    .select('id, title, author, asking_price_gbp, condition, books(cover_url)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const headersList = await headers()
  const referrer = headersList.get('referer') ?? null

  await supabase.from('shelf_visits').insert({
    username: user.username,
    referrer,
  })

  const safeListings = (listings ?? []) as unknown as Array<{
    id: number
    title: string
    author: string | null
    asking_price_gbp: number
    condition: string
    books: { cover_url: string | null } | null
  }>

  const APP_STORE_URL = `https://apps.apple.com/gb/app/sell-your-shelf/id6739630632?utm_source=shelf&utm_medium=share&utm_campaign=${user.username}`

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <nav style={{ background: '#2D4A3E', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: '#FAF8F5', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
          Sell Your Shelf
        </Link>
        <a href={APP_STORE_URL} style={{ background: '#FAF8F5', color: '#2D4A3E', fontSize: 13, fontWeight: 500, padding: '7px 16px', borderRadius: 6, textDecoration: 'none' }}>
          Get the app
        </a>
      </nav>

      <div style={{ borderBottom: '0.5px solid #E5E3DF', padding: '32px 24px 24px' }}>
        <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#2D4A3E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FAF8F5', fontSize: 20, fontWeight: 500, flexShrink: 0 }}>
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#1A1A1A' }}>
              @{user.username}
            </div>
            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
              {safeListings.length} {safeListings.length === 1 ? 'book' : 'books'} for sale
              {user.location ? ` · ${user.location}` : ''}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
        <ShelfGrid listings={safeListings} />
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