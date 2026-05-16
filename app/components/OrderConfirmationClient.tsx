'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useBasket } from './BasketProvider'

// How aggressively we poll for webhook-driven order updates. The Stripe
// webhook typically arrives within 1-2 seconds of the client-side redirect
// to this page, but cold starts can push it to 5-10s. Cap at ~40s to avoid
// hammering the server if something is wrong.
const POLL_INTERVAL_MS = 2_000
const POLL_MAX_MS = 40_000

const FOREST = '#2D4A3E'
const FOREST_DEEP = '#1F3329'
const CREAM = '#FAF8F5'
const GOLD = '#C9A961'

type Props = {
  orderId: string
  status: string
  sellerUsername: string | null
  buyerEmail: string | null
  items: Array<{ id: string; title: string; author: string | null; price_gbp: number }>
  subtotalGbp: number
  shippingGbp: number
  walletAppliedGbp: number
  cardChargedGbp: number
  totalGbp: number
  shippingAddress: Record<string, unknown> | null
}

export default function OrderConfirmationClient(props: Props) {
  const { clearBasket } = useBasket()
  const router = useRouter()

  // The basket should have been cleared at payment-submit time; clear again
  // here as a safety net so users who land directly on this URL (e.g. from an
  // email link) don't see their old basket on the next page they visit.
  const [cleared, setCleared] = useState(false)
  useEffect(() => {
    if (cleared) return
    clearBasket()
    setCleared(true)
  }, [cleared, clearBasket])

  const itemCount = props.items.length
  const isPaid =
    props.status === 'paid' ||
    props.status === 'shipped' ||
    props.status === 'delivered' ||
    props.status === 'completed'

  // Poll for webhook completion. The confirmation page is a server component,
  // so we trigger router.refresh() (re-runs the RSC fetch) until status flips
  // out of payment_pending. Stops on success or after POLL_MAX_MS.
  const pollStartRef = useRef<number | null>(null)
  const [givingUp, setGivingUp] = useState(false)
  useEffect(() => {
    if (isPaid || props.status === 'cancelled') return
    if (pollStartRef.current === null) pollStartRef.current = Date.now()
    const id = setInterval(() => {
      const elapsed = Date.now() - (pollStartRef.current ?? Date.now())
      if (elapsed > POLL_MAX_MS) {
        setGivingUp(true)
        clearInterval(id)
        return
      }
      router.refresh()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isPaid, props.status, router])

  if (props.status === 'cancelled') {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, color: FOREST_DEEP, fontWeight: 600, marginBottom: 8 }}>
          Payment didn't go through
        </h1>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>
          We weren't able to take payment for this order. Nothing has been charged.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            background: FOREST,
            color: CREAM,
            fontSize: 14,
            fontWeight: 500,
            padding: '11px 22px',
            borderRadius: 8,
            textDecoration: 'none',
          }}
        >
          Continue browsing
        </Link>
      </div>
    )
  }

  if (!isPaid) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, color: FOREST_DEEP, fontWeight: 600, marginBottom: 8 }}>
          {givingUp ? 'Still waiting on payment confirmation…' : 'Confirming your payment…'}
        </h1>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 4 }}>
          {givingUp
            ? "It's taking longer than usual. Your payment is being processed — feel free to close this tab and we'll email you when it lands."
            : "We're waiting for Stripe to confirm. This usually takes a few seconds."}
        </p>
        <p style={{ color: '#999', fontSize: 12, marginTop: 12 }}>
          Order id <code>{props.orderId.slice(0, 8)}</code>
          {givingUp && (
            <>
              {' '}—{' '}
              <a href="mailto:support@sellyourshelf.com" style={{ color: FOREST }}>
                email support
              </a>{' '}
              if you'd like us to check on it.
            </>
          )}
        </p>
      </div>
    )
  }

  const addrName = (props.shippingAddress?.name as string | undefined) ?? '—'
  const addrLine1 = (props.shippingAddress?.line1 as string | undefined) ?? ''
  const addrLine2 = (props.shippingAddress?.line2 as string | undefined) ?? ''
  const addrCity = (props.shippingAddress?.city as string | undefined) ?? ''
  const addrPostcode = (props.shippingAddress?.postcode as string | undefined) ?? ''

  return (
    <div>
      <div
        style={{
          background: '#fff',
          border: `1px solid ${GOLD}`,
          borderRadius: 12,
          padding: '28px 24px',
          textAlign: 'center',
          marginBottom: 24,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: FOREST,
            color: GOLD,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            margin: '0 auto 12px',
          }}
        >
          ✓
        </div>
        <h1 style={{ fontSize: 24, color: FOREST_DEEP, fontWeight: 700, margin: '0 0 6px' }}>
          Order confirmed
        </h1>
        <p style={{ fontSize: 14, color: '#666', margin: 0 }}>
          {itemCount} {itemCount === 1 ? 'book' : 'books'}
          {props.sellerUsername ? ` from @${props.sellerUsername}` : ''} — total £{props.totalGbp.toFixed(2)}
        </p>
        {props.buyerEmail && (
          <p style={{ fontSize: 12, color: '#999', margin: '10px 0 0' }}>
            A confirmation email is on its way to {props.buyerEmail}.
          </p>
        )}
      </div>

      <SectionCard title="What happens next">
        <ol style={{ margin: 0, padding: '0 0 0 20px', fontSize: 14, color: '#333', lineHeight: 1.7 }}>
          <li>
            <strong>@{props.sellerUsername ?? 'The seller'}</strong> is notified and will pack your order.
          </li>
          <li>They'll generate a Yodel shipping label and drop the parcel at a Yodel Point.</li>
          <li>We'll email you tracking when it ships — usually within 1–2 working days.</li>
          <li>Expect delivery within 2–3 working days after dispatch.</li>
        </ol>
      </SectionCard>

      <SectionCard title="Order summary">
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {props.items.map((it) => (
            <li
              key={it.id}
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#333' }}
            >
              <span style={{ flex: 1, paddingRight: 8 }}>
                {it.title}
                {it.author ? ` · ${it.author}` : ''}
              </span>
              <span style={{ color: '#1A1A1A' }}>£{Number(it.price_gbp).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div style={{ borderTop: '0.5px solid #E5E3DF', marginTop: 12, paddingTop: 12 }}>
          <Row label="Subtotal" value={`£${props.subtotalGbp.toFixed(2)}`} />
          <Row
            label="Shipping"
            value={props.shippingGbp === 0 ? 'Free' : `£${props.shippingGbp.toFixed(2)}`}
            highlight={props.shippingGbp === 0}
          />
          {props.walletAppliedGbp > 0 && (
            <Row label="Wallet applied" value={`−£${props.walletAppliedGbp.toFixed(2)}`} />
          )}
          <div style={{ borderTop: '0.5px solid #E5E3DF', marginTop: 10, paddingTop: 10 }}>
            <Row label={<strong>Total</strong>} value={<strong>£{props.totalGbp.toFixed(2)}</strong>} />
            {props.cardChargedGbp > 0 && (
              <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                Charged to your card: £{props.cardChargedGbp.toFixed(2)}
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Shipping to">
        <p style={{ fontSize: 14, color: '#1A1A1A', margin: 0, lineHeight: 1.5 }}>
          <strong>{addrName}</strong>
          <br />
          {addrLine1}
          {addrLine2 ? (
            <>
              <br />
              {addrLine2}
            </>
          ) : null}
          <br />
          {addrCity}
          {addrPostcode ? `, ${addrPostcode}` : ''}
        </p>
      </SectionCard>

      <Link
        href={`/orders/${props.orderId}${
          props.buyerEmail ? `?email=${encodeURIComponent(props.buyerEmail)}` : ''
        }`}
        style={{
          display: 'block',
          textAlign: 'center',
          background: '#fff',
          color: FOREST,
          border: `1px solid ${FOREST}`,
          fontSize: 14,
          fontWeight: 500,
          padding: '11px 0',
          borderRadius: 8,
          textDecoration: 'none',
          marginTop: 8,
        }}
      >
        View order details
      </Link>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '0.5px solid #E5E3DF',
        borderRadius: 10,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: FOREST_DEEP, marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: React.ReactNode
  value: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <span style={{ fontSize: 14, color: '#333' }}>{label}</span>
      <span style={{ fontSize: 14, color: highlight ? GOLD : '#1A1A1A', fontWeight: highlight ? 600 : 400 }}>
        {value}
      </span>
    </div>
  )
}
