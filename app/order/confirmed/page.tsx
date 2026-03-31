import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'

export const revalidate = 0

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function OrderConfirmedPage({ searchParams }: Props) {
  const params = await searchParams
  const paymentIntentParam = params.payment_intent as string | undefined
  const transactionIdParam = params.transaction_id as string | undefined

  let transaction: any = null

  // Look up by payment_intent (new flow) or transaction_id (legacy)
  if (paymentIntentParam) {
    // Webhook may not have fired yet — retry a few times
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data } = await supabase
        .from('transactions')
        .select(`
          id, status, sale_price_gbp, shipping_cost_gbp,
          listings(title, author, books(cover_url)),
          users:seller_id(username)
        `)
        .eq('stripe_payment_intent_id', paymentIntentParam)
        .single()

      if (data) {
        transaction = data
        break
      }

      // Wait 2 seconds before retrying (webhook may still be processing)
      if (attempt < 4) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  } else if (transactionIdParam) {
    const { data } = await supabase
      .from('transactions')
      .select(`
        id, status, sale_price_gbp, shipping_cost_gbp,
        listings(title, author, books(cover_url)),
        users:seller_id(username)
      `)
      .eq('id', transactionIdParam)
      .single()

    transaction = data
  }

  const book = transaction?.listings as any
  const seller = transaction?.users as any
  const cover = book?.books?.cover_url
  const totalPaid = transaction
    ? (Number(transaction.sale_price_gbp) + Number(transaction.shipping_cost_gbp)).toFixed(2)
    : null
  const appStoreUrl = 'https://apps.apple.com/gb/app/sell-your-shelf/id6739630632?utm_source=web_checkout&utm_medium=confirmation&utm_campaign=order_confirmed'

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <SiteNav />

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>

        <div style={{ fontSize: 48, marginBottom: 16 }}>&#x2705;</div>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>
          Order confirmed!
        </h1>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 32 }}>
          Thank you for your purchase{totalPaid ? ` of \u00A3${totalPaid}` : ''}.
        </p>

        {transaction ? (
          <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 10, padding: '24px', marginBottom: 32, textAlign: 'left' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'start' }}>
              {cover && (
                <div style={{ width: 80, borderRadius: 8, overflow: 'hidden', background: '#2D4A3E', aspectRatio: '2/3', flexShrink: 0 }}>
                  <img src={cover} alt={book?.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              )}
              <div>
                <p style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>
                  {book?.title}
                </p>
                {book?.author && (
                  <p style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                    by {book.author}
                  </p>
                )}
                {seller?.username && (
                  <p style={{ fontSize: 13, color: '#999' }}>
                    Sold by @{seller.username}
                  </p>
                )}
              </div>
            </div>

            <p style={{ fontSize: 14, color: '#666', marginTop: 20, lineHeight: 1.6 }}>
              Your order is on its way to the seller. You&apos;ll get an email when it ships.
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 10, padding: '24px', marginBottom: 32 }}>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>
              Your payment has been received. We&apos;re setting up your order now &mdash; you&apos;ll receive a confirmation email shortly.
            </p>
          </div>
        )}

        {/* App Store CTA */}
        <div style={{ background: '#2D4A3E', borderRadius: 12, padding: '24px', marginBottom: 32 }}>
          <p style={{ color: '#FAF8F5', fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
            Download the app to track your order
          </p>
          <p style={{ color: 'rgba(250,248,245,0.7)', fontSize: 13, marginBottom: 20 }}>
            Get shipping updates, message your seller, and manage your account
          </p>
          <a
            href={appStoreUrl}
            style={{ display: 'inline-block', background: '#FAF8F5', color: '#2D4A3E', fontSize: 14, fontWeight: 600, padding: '12px 32px', borderRadius: 8, textDecoration: 'none' }}
          >
            Download on the App Store
          </a>
        </div>

        <Link href="/new" style={{ fontSize: 14, color: '#2D4A3E', textDecoration: 'none', fontWeight: 500 }}>
          Continue browsing →
        </Link>

      </div>

      <Footer />
    </div>
  )
}
