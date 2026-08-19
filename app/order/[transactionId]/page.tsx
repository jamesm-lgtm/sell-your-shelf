import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { formatDate } from '@/app/components/ui'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import AppBadges from '@/app/components/AppBadges'

export const revalidate = 0

// It had none, so a buyer's order tab read "Turn your bookshelf into cash"
// — the seller-facing site tagline, on the one page that is purely a
// buyer's receipt. Not indexed: it is somebody's order.
export const metadata: Metadata = {
  title: 'Track your order — Sell Your Shelf',
  robots: { index: false, follow: false },
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const STATUS_STEPS = ['paid', 'shipped', 'delivered'] as const

const STATUS_LABELS: Record<string, string> = {
  payment_pending: 'Payment Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
}

type Props = {
  params: Promise<{ transactionId: string }>
}

export default async function OrderStatusPage({ params }: Props) {
  const { transactionId } = await params

  const { data: transaction, error } = await supabase
    .from('transactions')
    .select(`
      id, status, sale_price_gbp, shipped_at, created_at,
      listings(title, author, books(cover_url)),
      users:seller_id(username)
    `)
    .eq('id', transactionId)
    .single()

  if (error || !transaction) return notFound()

  const book = transaction.listings as any
  const seller = transaction.users as any
  const cover = book?.books?.cover_url

  const currentStepIndex = STATUS_STEPS.indexOf(transaction.status as any)

  return (
    <div className="sy-page">

      <SiteNav />

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 24px' }}>

        <p style={{ fontSize: 13, color: 'var(--color-ink-faint)', marginBottom: 8 }}>Order #{transaction.id}</p>

        <div style={{ background: '#fff', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-md)', padding: '24px', marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'start', marginBottom: 24 }}>
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

          {/* Status tracker */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink-soft)', marginBottom: 12 }}>Status</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {STATUS_STEPS.map((step, i) => {
                const isActive = i <= currentStepIndex
                const isCurrent = step === transaction.status

                return (
                  <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: isActive ? 'var(--color-ground)' : 'var(--color-paper-warm)',
                      color: isActive ? 'var(--color-paper)' : 'var(--color-ink-faint)',
                      fontSize: 12,
                      fontWeight: isCurrent ? 600 : 400,
                      whiteSpace: 'nowrap',
                    }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: isActive ? 'var(--color-paper)' : 'var(--color-rule)',
                        display: 'inline-block',
                      }} />
                      {STATUS_LABELS[step] ?? step}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {transaction.status === 'shipped' && transaction.shipped_at && (
            <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', marginTop: 12 }}>
              Shipped on {formatDate(transaction.shipped_at, { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* App badges */}
        <div style={{ background: 'var(--color-ground)', borderRadius: 'var(--radius-md)', padding: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-paper)', fontSize: 15, fontWeight: 500, marginBottom: 16 }}>
            Download the Sell Your Shelf app
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <AppBadges
              utm={{ source: 'web_checkout', medium: 'order_status', campaign: 'order_status' }}
              size="md"
              layout="auto"
              align="center"
            />
          </div>
        </div>

      </div>

      <Footer />
    </div>
  )
}
