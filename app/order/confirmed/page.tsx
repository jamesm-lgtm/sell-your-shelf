import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import AppBadges from '@/app/components/AppBadges'
import GaPurchase from '@/app/components/GaPurchase'

export const revalidate = 0

// A buyer's order confirmation — private, and it fires the GA purchase
// event on mount. Mirrors /orders/[id]/confirmation, already noindex.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

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
  return (
    <div className="sy-page">
      {transaction && totalPaid && (
        <GaPurchase
          transactionId={paymentIntentParam || String(transaction.id)}
          value={Number(totalPaid)}
          items={[{ item_id: String(transaction.id), item_name: book?.title ?? 'Book' }]}
        />
      )}

      <SiteNav />

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '48px 24px', textAlign: 'center' }}>

        <div style={{ fontSize: 48, marginBottom: 16 }}>&#x2705;</div>
        <h1 className="sy-h2" style={{ marginBottom: 8 }}>
          Order confirmed!
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-ink-soft)', marginBottom: 32 }}>
          Thank you for your purchase{totalPaid ? ` of \u00A3${totalPaid}` : ''}.
        </p>

        {transaction ? (
          <div style={{ background: '#fff', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: 32, textAlign: 'left' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'start' }}>
              {cover && (
                <div style={{ width: 80, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--color-ground)', aspectRatio: '2/3', flexShrink: 0 }}>
                  <img src={cover} alt={book?.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              )}
              <div>
                <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-ink)', marginBottom: 4 }}>
                  {book?.title}
                </p>
                {book?.author && (
                  <p style={{ fontSize: 14, color: 'var(--color-ink-soft)', marginBottom: 8 }}>
                    by {book.author}
                  </p>
                )}
                {seller?.username && (
                  <p style={{ fontSize: 13, color: 'var(--color-ink-faint)' }}>
                    Sold by @{seller.username}
                  </p>
                )}
              </div>
            </div>

            <p style={{ fontSize: 14, color: 'var(--color-ink-soft)', marginTop: 20, lineHeight: 1.6 }}>
              Your order is on its way to the seller. You&apos;ll get an email when it ships.
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: 32 }}>
            <p style={{ fontSize: 14, color: 'var(--color-ink-soft)', lineHeight: 1.6 }}>
              Your payment has been received. We&apos;re setting up your order now &mdash; you&apos;ll receive a confirmation email shortly.
            </p>
          </div>
        )}

        {/* App badges */}
        <div style={{ background: 'var(--color-ground)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: 32 }}>
          <p style={{ color: 'var(--color-paper)', fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
            Download the app to track your order
          </p>
          <p style={{ color: 'rgba(250,248,245,0.7)', fontSize: 13, marginBottom: 20 }}>
            Get shipping updates, message your seller, and manage your account
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <AppBadges
              utm={{ source: 'web_checkout', medium: 'confirmation', campaign: 'order_confirmed' }}
              size="md"
              layout="auto"
              align="center"
            />
          </div>
        </div>

        <Link href="/new" style={{ fontSize: 14, color: 'var(--color-ground)', textDecoration: 'none', fontWeight: 500 }}>
          Continue browsing →
        </Link>

      </div>

      <Footer />
    </div>
  )
}
