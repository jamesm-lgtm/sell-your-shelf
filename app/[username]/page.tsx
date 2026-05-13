import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import ShelfGrid from '@/app/components/ShelfGrid'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import ShelfVisitTracker from '@/app/components/ShelfVisitTracker'
import ThresholdGapAssistant from '@/app/components/ThresholdGapAssistant'
import { RegisterShelfInventory } from '@/app/components/ShelfInventoryProvider'

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
    .select('asking_price_gbp, books(cover_url, cover_url_hosted)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('asking_price_gbp', { ascending: true })

  const count = listings?.length ?? 0
  const fromPrice = listings?.[0]?.asking_price_gbp
    ? `£${Number(listings[0].asking_price_gbp).toFixed(2)}`
    : null
  const ogImage = (listings as any)?.find((l: any) => l.books?.cover_url_hosted || l.books?.cover_url)?.books?.cover_url_hosted
    ?? (listings as any)?.find((l: any) => l.books?.cover_url)?.books?.cover_url
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
    .select('id, title, author, asking_price_gbp, condition, format, books(cover_url, cover_url_hosted, category)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const safeListings = (listings ?? []) as unknown as Array<{
    id: number
    title: string
    author: string | null
    asking_price_gbp: number
    condition: string
    format: 'paperback' | 'hardback' | null
    books: { cover_url: string | null; cover_url_hosted?: string | null; category?: string | null } | null
  }>

  const APP_STORE_URL = `https://apps.apple.com/gb/app/sell-your-shelf/id6739630632?utm_source=shelf&utm_medium=share&utm_campaign=${user.username}`

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <SiteNav />

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
        <ThresholdGapAssistant
          listings={safeListings}
          seller={{ sellerId: user.id, sellerUsername: user.username }}
        />
        <ShelfGrid
          listings={safeListings}
          seller={{ sellerId: user.id, sellerUsername: user.username }}
        />
      </div>

      <RegisterShelfInventory
        listings={safeListings}
        seller={{ sellerId: user.id, sellerUsername: user.username }}
      />
      <ShelfVisitTracker username={user.username} />

      <Footer />

    </div>
  )
}