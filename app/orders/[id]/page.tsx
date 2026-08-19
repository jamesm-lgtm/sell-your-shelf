import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/app/components/ui'
import { createClient } from '@supabase/supabase-js'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'

export const revalidate = 0
export const metadata: Metadata = {
  title: 'Your order — Sell Your Shelf',
  robots: { index: false, follow: false },
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

const FOREST = 'var(--color-ground)'
const FOREST_DEEP = 'var(--color-ground-deep)'
const CREAM = 'var(--color-paper)'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ email?: string }>
}

const STATUS_COPY: Record<string, { label: string; description: string }> = {
  payment_pending: { label: 'Payment pending', description: 'Waiting for payment to clear.' },
  paid: { label: 'Confirmed', description: 'The seller is preparing your order for dispatch.' },
  shipped: { label: 'Shipped', description: 'Your order is on its way.' },
  delivered: { label: 'Delivered', description: 'Your order has arrived.' },
  completed: { label: 'Completed', description: 'This order is closed.' },
  cancelled: { label: 'Cancelled', description: 'This order was cancelled.' },
}

export default async function OrderDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { email } = await searchParams

  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound()

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, status, buyer_email, buyer_id, total_gbp, subtotal_gbp, shipping_gbp,
      wallet_applied_gbp, card_charged_gbp, seller_id, parcel_tier,
      shipping_address, tracking_number, tracking_url, shipping_method,
      created_at, paid_at, shipped_at, delivered_at,
      seller:seller_id(username),
      order_items(id, title, author, price_gbp)
    `)
    .eq('id', id)
    .single()

  if (!order) return notFound()

  // Auth gate: require ?email=... matches the order's buyer_email. We don't
  // have web auth state, so this is the only access control. The order id is
  // a uuid (effectively unguessable) — but adding the email check stops casual
  // url-sharing from leaking order details.
  const requiresAuth = !email || email.toLowerCase() !== (order.buyer_email ?? '').toLowerCase()
  if (requiresAuth) {
    return (
      <Shell>
        <h1 className="sy-h3">View your order</h1>
        <p style={{ fontSize: 14, color: 'var(--color-ink-soft)', marginTop: 8 }}>
          Confirm the email address you used at checkout to view this order.
        </p>
        <form
          method="get"
          style={{
            marginTop: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            maxWidth: 380,
          }}
        >
          <label style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>Email address</label>
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 14,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-rule)',
              background: '#fff',
              color: 'var(--color-ink)',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              background: 'var(--color-action)',
              color: CREAM,
              border: 'none',
              fontSize: 14,
              fontWeight: 500,
              padding: '11px 0',
              borderRadius: 'var(--radius-pill)',
              cursor: 'pointer',
            }}
          >
            View order
          </button>
        </form>
        <p style={{ fontSize: 12, color: 'var(--color-ink-faint)', marginTop: 16 }}>
          If you can't remember the email, contact{' '}
          <a href="mailto:support@sellyourshelf.com" style={{ color: FOREST }}>
            support@sellyourshelf.com
          </a>
          .
        </p>
      </Shell>
    )
  }

  const seller = (order as { seller?: { username?: string } | null }).seller
  const items = (order as { order_items?: Array<{ id: string; title: string; author: string | null; price_gbp: number }> }).order_items ?? []
  const status = order.status as string
  const statusCopy = STATUS_COPY[status] ?? { label: status, description: '' }

  const addr = (order.shipping_address ?? {}) as Record<string, string>

  return (
    <Shell>
      <h1 className="sy-h3" style={{ margin: 0 }}>Your order</h1>
      <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', margin: '4px 0 0' }}>
        Order <code style={{ background: 'var(--color-paper-warm)', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>{(order.id as string).slice(0, 8)}</code>
        {' · placed '}
        {formatDate(order.created_at as string)}
      </p>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: FOREST_DEEP }}>{statusCopy.label}</div>
            <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', margin: '4px 0 0' }}>{statusCopy.description}</p>
          </div>
          {seller?.username && (
            <Link
              href={`/${seller.username}`}
              style={{ fontSize: 12, color: FOREST, textDecoration: 'underline' }}
            >
              @{seller.username}
            </Link>
          )}
        </div>

        {order.tracking_number && (
          <div style={{ marginTop: 14, padding: 12, background: 'var(--color-paper-warm)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 13, color: 'var(--color-ink)', fontWeight: 500 }}>
              Tracking:{' '}
              <code style={{ background: '#fff', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>
                {order.tracking_number as string}
              </code>
            </div>
            {order.tracking_url && (
              <a
                href={order.tracking_url as string}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: FOREST, marginTop: 4, display: 'inline-block' }}
              >
                Track parcel →
              </a>
            )}
          </div>
        )}
      </Card>

      <Card title="Items">
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it) => (
            <li
              key={it.id}
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-ink)' }}
            >
              <span style={{ flex: 1, paddingRight: 8 }}>
                {it.title}
                {it.author ? ` · ${it.author}` : ''}
              </span>
              <span style={{ color: 'var(--color-ink)' }}>£{Number(it.price_gbp).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Payment">
        <Row label="Subtotal" value={`£${Number(order.subtotal_gbp).toFixed(2)}`} />
        <Row
          label="Shipping"
          value={
            Number(order.shipping_gbp) === 0
              ? 'Free'
              : `£${Number(order.shipping_gbp).toFixed(2)}`
          }
        />
        {Number(order.wallet_applied_gbp) > 0 && (
          <Row label="Wallet applied" value={`−£${Number(order.wallet_applied_gbp).toFixed(2)}`} />
        )}
        <div style={{ borderTop: '1px solid var(--color-rule)', marginTop: 10, paddingTop: 10 }}>
          <Row label={<strong>Total</strong>} value={<strong>£{Number(order.total_gbp).toFixed(2)}</strong>} />
        </div>
      </Card>

      <Card title="Delivery">
        <p style={{ fontSize: 14, color: 'var(--color-ink)', margin: 0, lineHeight: 1.5 }}>
          <strong>{addr.name ?? '—'}</strong>
          <br />
          {addr.line1}
          {addr.line2 ? (
            <>
              <br />
              {addr.line2}
            </>
          ) : null}
          <br />
          {addr.city}
          {addr.postcode ? `, ${addr.postcode}` : ''}
        </p>
      </Card>

      <p style={{ fontSize: 12, color: 'var(--color-ink-faint)', textAlign: 'center', marginTop: 24 }}>
        Questions? <a href="mailto:support@sellyourshelf.com" style={{ color: FOREST }}>support@sellyourshelf.com</a>
      </p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="sy-page">
      <SiteNav />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 64px' }}>{children}</div>
      <Footer />
    </div>
  )
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--color-rule)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
        marginTop: 16,
      }}
    >
      {title && (
        <div style={{ fontSize: 14, fontWeight: 600, color: FOREST_DEEP, marginBottom: 12 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

function Row({
  label,
  value,
}: {
  label: React.ReactNode
  value: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ fontSize: 14, color: 'var(--color-ink)' }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--color-ink)' }}>{value}</span>
    </div>
  )
}
