import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import SiteNav from '@/app/components/SiteNav'
import Footer from '@/app/components/Footer'
import OrderConfirmationClient from '@/app/components/OrderConfirmationClient'
import GaPurchase from '@/app/components/GaPurchase'

export const revalidate = 0
export const metadata: Metadata = {
  title: 'Order confirmed — Sell Your Shelf',
  robots: { index: false, follow: false },
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

type Props = { params: Promise<{ id: string }> }

export default async function OrderConfirmationPage({ params }: Props) {
  const { id } = await params

  // UUID-shape sanity check before hitting the DB
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound()

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, status, buyer_email, total_gbp, subtotal_gbp, shipping_gbp,
      wallet_applied_gbp, card_charged_gbp, seller_id, parcel_tier,
      shipping_address, created_at, paid_at,
      seller:seller_id(username),
      order_items(id, title, author, price_gbp)
    `)
    .eq('id', id)
    .single()

  if (!order) return notFound()

  const sellerUsername = (order as { seller?: { username?: string } | null }).seller?.username ?? null
  const items = (order as { order_items?: Array<{ id: string; title: string; author: string | null; price_gbp: number }> }).order_items ?? []

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {['paid', 'shipped', 'delivered', 'completed'].includes(order.status as string) && (
        <GaPurchase
          transactionId={order.id as string}
          value={Number(order.total_gbp)}
          items={items.map((it) => ({
            item_id: String(it.id),
            item_name: it.title,
            price: Number(it.price_gbp),
          }))}
        />
      )}
      <SiteNav />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 64px' }}>
        <OrderConfirmationClient
          orderId={order.id as string}
          status={order.status as string}
          sellerUsername={sellerUsername}
          buyerEmail={order.buyer_email as string | null}
          items={items}
          subtotalGbp={Number(order.subtotal_gbp)}
          shippingGbp={Number(order.shipping_gbp)}
          walletAppliedGbp={Number(order.wallet_applied_gbp)}
          cardChargedGbp={Number(order.card_charged_gbp)}
          totalGbp={Number(order.total_gbp)}
          shippingAddress={order.shipping_address as Record<string, unknown> | null}
        />
        <div style={{ marginTop: 28, fontSize: 13, color: '#666', textAlign: 'center' }}>
          <Link href="/" style={{ color: '#2D4A3E', textDecoration: 'underline' }}>
            Continue browsing
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
