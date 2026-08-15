import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import CheckoutForm from '@/app/components/CheckoutForm'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'

export const revalidate = 0

// Never index a checkout: it can't rank, and CheckoutForm fires a
// checkout_started event on mount, so every crawl manufactured a phantom
// checkout start in the funnel. Matches /checkout and /basket, which were
// already noindex.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

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
      id, title, author, asking_price_gbp, condition, status, user_id,
      books(cover_url, cover_url_hosted),
      listing_images(url, sort_order),
      users(username)
    `)
    .eq('id', listingId)
    .single()

  if (error || !listing || listing.status !== 'active') {
    redirect(`/listing/${listingId}`)
  }

  // Check seller wallet separately. Mirror web-create-payment-intent's gate
  // exactly — checking only onboarding_step lets buyers reach this page during
  // the window where the seller has finished their KYC steps but Stripe hasn't
  // yet enabled charges (status flips from 'pending'/'restricted' → 'enabled'
  // on the account.updated webhook). Without the status check, the buyer fills
  // out the form, taps Pay, and only then gets "This seller cannot receive
  // payments yet" from the edge function.
  const { data: wallet } = await supabase
    .from('user_wallets')
    .select('onboarding_step, stripe_account_status')
    .eq('user_id', listing.user_id)
    .single()

  if (
    !wallet ||
    wallet.onboarding_step !== 'complete' ||
    wallet.stripe_account_status !== 'enabled'
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
    cover_url_hosted: (listing.books as any)?.cover_url_hosted ?? null,
    listing_images: (listing as any).listing_images ?? null,
    username: (listing.users as any)?.username ?? null,
  }

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <SiteNav />

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1A1A1A', marginBottom: 32 }}>
          Checkout
        </h1>

        <CheckoutForm listing={listingData} />
      </div>

      <Footer />

    </div>
  )
}
