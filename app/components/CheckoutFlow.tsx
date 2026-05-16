'use client'

import { useEffect, useMemo, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { useBasket, useBasketShipping } from './BasketProvider'
import {
  FREE_SHIPPING_THRESHOLD_GBP,
  SHIPPING_FLAT_GBP,
  SOFT_CAP_WEIGHT_G,
} from '@/app/lib/basket'
import {
  trackCheckoutInitiated,
  trackCheckoutStaleItemsDetected,
} from '@/app/lib/basketAnalytics'

const FOREST = '#2D4A3E'
const FOREST_DEEP = '#1F3329'
const CREAM = '#FAF8F5'
const GOLD = '#C9A961'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

const stripePromise: Promise<Stripe | null> = STRIPE_PK
  ? loadStripe(STRIPE_PK)
  : Promise.resolve(null)

type StaleItem = { id: number; title: string | null; reason: string }

export default function CheckoutFlow() {
  const { basket, clearBasket, removeItem } = useBasket()
  const { state, subtotal, weightG } = useBasketShipping()
  const [hydrated, setHydrated] = useState(false)

  // ----- form fields -----
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')

  // ----- flow state -----
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staleItems, setStaleItems] = useState<StaleItem[]>([])
  const [orderId, setOrderId] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [walletCovered, setWalletCovered] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  // Surface a configuration warning if the publishable key isn't set in the
  // Vercel environment. The form still renders so layout can be reviewed.
  const stripeConfigured = !!STRIPE_PK

  const items = basket?.items ?? []
  // Phase 1B Q1: flat £2.50 below £10 subtotal, free at/above. Weight only
  // affects the soft-warn / hard-stop UX, not the shipping fee.
  const shippingGbp = useMemo(
    () => (state.kind === 'unlocked' ? 0 : SHIPPING_FLAT_GBP),
    [state.kind],
  )
  const totalGbp = subtotal + shippingGbp

  if (!hydrated) {
    return <div style={{ color: '#999', fontSize: 14, padding: 24 }}>Loading checkout…</div>
  }

  if (!basket || items.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, color: FOREST_DEEP, fontWeight: 600, marginBottom: 8 }}>
          Your basket is empty
        </h1>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
          Add books to your basket before checking out.
        </p>
        <Link
          href="/browse"
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
          Browse books
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!basket) return
    setError(null)
    setStaleItems([])

    // Minimal validation; the edge function repeats these checks.
    if (!/^.+@.+\..+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !line1.trim() ||
      !city.trim() ||
      !postcode.trim()
    ) {
      setError('Please complete all required fields')
      return
    }

    setSubmitting(true)

    // Phase 1B analytics: fire on the actual checkout start (this is the
    // "buyer commits" moment, distinct from clicking the basket Checkout
    // button which the /basket page already tracks).
    trackCheckoutInitiated({ basket, isGuest: true, applyWallet: false })

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-order-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingIds: items.map((it) => it.listingId),
          shippingAddress: {
            name: `${firstName.trim()} ${lastName.trim()}`,
            line1: line1.trim(),
            line2: line2.trim() || undefined,
            city: city.trim(),
            postcode: postcode.trim(),
            country: 'GB',
          },
          buyerEmail: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          password,
          // applyWallet is not exposed on the web flow yet — every web buyer
          // is a guest, so they can't have a Stripe Connect balance to spend.
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (res.status === 409 && Array.isArray(data?.stale_items)) {
        const stale = data.stale_items as StaleItem[]
        setStaleItems(stale)
        trackCheckoutStaleItemsDetected({ basket, staleItemCount: stale.length })
        return
      }

      if (!res.ok) {
        throw new Error(data?.error || `Checkout failed (${res.status})`)
      }

      setOrderId(data.order_id)

      // Wallet-only path: edge function handled everything in-process. Jump
      // straight to confirmation and clear the basket.
      if (data.requires_payment === false) {
        setWalletCovered(true)
        clearBasket()
        window.location.assign(`/orders/${data.order_id}/confirmation`)
        return
      }

      // Card path: render the Stripe Elements PaymentElement below.
      setClientSecret(data.stripe_payment_intent_client_secret)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // ----- after PI created, render Stripe Elements -----
  if (clientSecret && orderId) {
    if (!stripeConfigured) {
      return (
        <ConfigError
          message="Payment is not configured on this environment. Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY."
        />
      )
    }
    return (
      <div>
        <SummaryCard
          items={items.map((it) => ({ title: it.title, author: it.author, priceGbp: Number(it.priceGbp) }))}
          subtotal={subtotal}
          shipping={shippingGbp}
          total={totalGbp}
        />
        <h2 style={h2Style}>Payment</h2>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'stripe',
              variables: { colorPrimary: FOREST, fontFamily: 'system-ui, sans-serif' },
            },
          }}
        >
          <PaymentForm orderId={orderId} onSuccess={() => clearBasket()} />
        </Elements>
      </div>
    )
  }

  if (walletCovered && orderId) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <p style={{ fontSize: 14, color: '#666' }}>Order placed — redirecting to confirmation…</p>
      </div>
    )
  }

  // ----- initial form -----
  return (
    <div>
      <h1 style={{ fontSize: 22, color: FOREST_DEEP, fontWeight: 600, margin: 0 }}>
        Checkout
      </h1>
      <p style={{ fontSize: 13, color: '#666', margin: '4px 0 20px' }}>
        From{' '}
        <Link href={`/${basket.sellerUsername}`} style={{ color: FOREST, textDecoration: 'underline' }}>
          @{basket.sellerUsername}
        </Link>
      </p>

      <SummaryCard
        items={items.map((it) => ({ title: it.title, author: it.author, priceGbp: Number(it.priceGbp) }))}
        subtotal={subtotal}
        shipping={shippingGbp}
        total={totalGbp}
        weightG={weightG}
      />

      {staleItems.length > 0 && (
        <div style={staleBoxStyle}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#6A4F0E', marginBottom: 6 }}>
            Some items are no longer available
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#6A4F0E', listStyle: 'disc' }}>
            {staleItems.map((s) => (
              <li key={s.id} style={{ marginBottom: 4 }}>
                {s.title ?? `Listing #${s.id}`} — {s.reason}
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              for (const s of staleItems) removeItem(s.id, 'basket_page')
              setStaleItems([])
            }}
            style={{
              marginTop: 10,
              background: FOREST,
              color: CREAM,
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              padding: '8px 14px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Remove and continue
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
        <h2 style={h2Style}>Your account</h2>
        <div style={fieldRowStyle}>
          <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        </div>
        <div style={fieldRowStyle}>
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            hint="Min 6 characters. We'll create your account when payment succeeds."
            required
          />
        </div>

        <h2 style={h2Style}>Shipping</h2>
        <div style={twoColStyle}>
          <Field label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" required />
          <Field label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" required />
        </div>
        <div style={fieldRowStyle}>
          <Field label="Address line 1" value={line1} onChange={setLine1} autoComplete="address-line1" required />
        </div>
        <div style={fieldRowStyle}>
          <Field
            label="Address line 2 (optional)"
            value={line2}
            onChange={setLine2}
            autoComplete="address-line2"
          />
        </div>
        <div style={twoColStyle}>
          <Field label="City" value={city} onChange={setCity} autoComplete="address-level2" required />
          <Field label="Postcode" value={postcode} onChange={setPostcode} autoComplete="postal-code" required />
        </div>

        {error && (
          <div style={errorBoxStyle}>{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            marginTop: 24,
            width: '100%',
            background: submitting ? '#B8B8B8' : FOREST,
            color: CREAM,
            border: 'none',
            fontSize: 15,
            fontWeight: 600,
            padding: '13px 0',
            borderRadius: 8,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Setting up payment…' : 'Continue to payment'}
        </button>
        <p style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 10 }}>
          You'll review the order before charging your card.
        </p>
      </form>
    </div>
  )
}

// ---------- subcomponents ----------

function PaymentForm({
  orderId,
  onSuccess,
}: {
  orderId: string
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePay = async (e: FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setError(null)

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders/${orderId}/confirmation`,
        },
        redirect: 'if_required',
      })

      if (result.error) {
        setError(result.error.message || 'Payment failed')
        setSubmitting(false)
        return
      }

      if (result.paymentIntent?.status === 'succeeded') {
        onSuccess()
        router.push(`/orders/${orderId}/confirmation`)
        return
      }

      // Some payment methods require a redirect; if redirect: 'if_required'
      // returned without success and without error, Stripe will navigate
      // automatically via confirmParams.return_url.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handlePay}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <div style={errorBoxStyle}>{error}</div>}
      <button
        type="submit"
        disabled={!stripe || submitting}
        style={{
          marginTop: 16,
          width: '100%',
          background: submitting ? '#B8B8B8' : FOREST,
          color: CREAM,
          border: 'none',
          fontSize: 15,
          fontWeight: 600,
          padding: '13px 0',
          borderRadius: 8,
          cursor: submitting ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? 'Processing…' : 'Pay now'}
      </button>
      <p style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 10 }}>
        Your card will only be charged once payment succeeds.
      </p>
    </form>
  )
}

function SummaryCard({
  items,
  subtotal,
  shipping,
  total,
  weightG,
}: {
  items: Array<{ title: string; author: string | null; priceGbp: number }>
  subtotal: number
  shipping: number
  total: number
  weightG?: number
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '0.5px solid #E5E3DF',
        borderRadius: 10,
        padding: 16,
        marginBottom: 20,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: FOREST_DEEP, marginBottom: 12 }}>
        Order summary
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, idx) => (
          <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#333' }}>
            <span style={{ flex: 1, paddingRight: 8 }}>
              {it.title}
              {it.author ? ` · ${it.author}` : ''}
            </span>
            <span style={{ color: '#1A1A1A' }}>£{it.priceGbp.toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <div style={{ borderTop: '0.5px solid #E5E3DF', marginTop: 12, paddingTop: 12 }}>
        <Row label="Subtotal" value={`£${subtotal.toFixed(2)}`} />
        <Row
          label="Shipping"
          value={shipping === 0 ? 'Free' : `£${shipping.toFixed(2)}`}
          highlight={shipping === 0}
          hint={
            shipping === 0
              ? `Free over £${FREE_SHIPPING_THRESHOLD_GBP}`
              : undefined
          }
        />
        <div style={{ borderTop: '0.5px solid #E5E3DF', marginTop: 10, paddingTop: 10 }}>
          <Row label={<strong>Total</strong>} value={<strong>£{total.toFixed(2)}</strong>} />
        </div>
        {weightG && weightG > SOFT_CAP_WEIGHT_G && (
          <p style={{ fontSize: 11, color: '#B85C00', marginTop: 8 }}>
            Your basket is approaching our 5kg limit ({(weightG / 1000).toFixed(1)}kg).
          </p>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: string
  highlight?: boolean
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 0' }}>
        <span style={{ fontSize: 14, color: '#333' }}>{label}</span>
        <span style={{ fontSize: 14, color: highlight ? GOLD : '#1A1A1A', fontWeight: highlight ? 600 : 400 }}>
          {value}
        </span>
      </div>
      {hint && <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  hint,
  required,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  hint?: string
  required?: boolean
  autoComplete?: string
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        style={{
          width: '100%',
          padding: '10px 12px',
          fontSize: 14,
          borderRadius: 8,
          background: '#fff',
          border: '0.5px solid #E5E3DF',
          color: '#1A1A1A',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
      {hint && <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{hint}</div>}
    </label>
  )
}

function ConfigError({ message }: { message: string }) {
  return (
    <div style={{ padding: 24, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#991B1B', marginBottom: 6 }}>
        Checkout misconfigured
      </div>
      <p style={{ fontSize: 13, color: '#7F1D1D', margin: 0 }}>{message}</p>
    </div>
  )
}

const h2Style: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: FOREST_DEEP,
  marginTop: 20,
  marginBottom: 12,
}

const fieldRowStyle: React.CSSProperties = { marginBottom: 12 }
const twoColStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
  marginBottom: 12,
}

const errorBoxStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '10px 12px',
  background: '#FEF2F2',
  border: '1px solid #FCA5A5',
  borderRadius: 8,
  fontSize: 13,
  color: '#991B1B',
}

const staleBoxStyle: React.CSSProperties = {
  background: '#FFF7E6',
  border: '1px solid #E8C97A',
  borderRadius: 8,
  padding: '12px 14px',
  marginTop: 16,
}
