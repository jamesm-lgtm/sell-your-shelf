import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

export const revalidate = 0

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
  const appStoreUrl = 'https://apps.apple.com/gb/app/sell-your-shelf/id6739630632?utm_source=order_status&utm_medium=web'

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>

      <nav style={{ background: '#2D4A3E', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: '#FAF8F5', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
          Sell Your Shelf
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/new" style={{ color: 'rgba(250,248,245,0.8)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            Browse
          </Link>
          <Link href="/support" style={{ color: 'rgba(250,248,245,0.8)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            Support
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 24px' }}>

        <p style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>Order #{transaction.id}</p>

        <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 10, padding: '24px', marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'start', marginBottom: 24 }}>
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

          {/* Status tracker */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#666', marginBottom: 12 }}>Status</p>
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
                      borderRadius: 20,
                      background: isActive ? '#2D4A3E' : '#F0EDE8',
                      color: isActive ? '#FAF8F5' : '#999',
                      fontSize: 12,
                      fontWeight: isCurrent ? 600 : 400,
                      whiteSpace: 'nowrap',
                    }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: isActive ? '#FAF8F5' : '#ccc',
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
            <p style={{ fontSize: 13, color: '#666', marginTop: 12 }}>
              Shipped on {new Date(transaction.shipped_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
        </div>

        {/* App Store CTA */}
        <div style={{ background: '#2D4A3E', borderRadius: 12, padding: '24px', textAlign: 'center' }}>
          <p style={{ color: '#FAF8F5', fontSize: 15, fontWeight: 500, marginBottom: 16 }}>
            Download the Sell Your Shelf app
          </p>
          <a
            href={appStoreUrl}
            style={{ display: 'inline-block', background: '#FAF8F5', color: '#2D4A3E', fontSize: 14, fontWeight: 600, padding: '12px 32px', borderRadius: 8, textDecoration: 'none' }}
          >
            Download on the App Store
          </a>
        </div>

      </div>
    </div>
  )
}
