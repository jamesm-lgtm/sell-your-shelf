import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import CheckoutForm from '@/app/components/CheckoutForm'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

type Props = {
  params: Promise<{ listingId: string }>
}

export default async function CheckoutPage({ params }: Props) {
  const { listingId } = await params

  const { data: listing, error } = await supabase
    .from('listings')
    .select(`
      id, title, author, asking_price_gbp, condition, status,
      books(cover_url),
      users(username),
      user_wallets:user_id(onboarding_step)
    `)
    .eq('id', listingId)
    .single()

  // Redirect if listing is not purchasable
  if (
    error ||
    !listing ||
    listing.status !== 'active' ||
    !(listing.user_wallets as any)?.onboarding_step ||
    (listing.user_wallets as any)?.onboarding_step !== 'complete'
  ) {
    redirect(`/listing/${listingId}`)
  }

  const listingData = {
    id: listing.id,
    title: listing.title,
    author: listing.author,
    asking_price_gbp: Number(listing.asking_price_gbp),
    condition: listing.condition,
    cover_url: (listing.books as any)?.cover_url ?? null,
    username: (listing.users as any)?.username ?? null,
  }

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <nav style={{ background: '#2D4A3E', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: '#FAF8F5', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
          Sell Your Shelf
        </Link>
        <Link href={`/listing/${listingId}`} style={{ color: 'rgba(250,248,245,0.7)', fontSize: 13, textDecoration: 'none' }}>
          ← Back to listing
        </Link>
      </nav>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A1A', marginBottom: 32 }}>
          Checkout
        </h1>

        <CheckoutForm listing={listingData} />
      </div>

    </div>
  )
}
