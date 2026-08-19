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
import { gaEvent } from '@/app/lib/ga'

const FOREST = 'var(--color-ground)'
const FOREST_DEEP = 'var(--color-ground-deep)'
const CREAM = 'var(--color-paper)'
const GOLD = 'var(--color-accent)'

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
    return <div style={{ color: 'var(--color-ink-faint)', fontSize: 14, padding: 24 }}>Loading checkout…</div>
  }

  if (!basket || items.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, color: FOREST_DEEP, fontWeight: 600, marginBottom: 8 }}>
          Your basket is empty
        </h1>
        <p style={{ color: 'var(--color-ink-soft)', fontSize: 14, marginBottom: 24 }}>
          Add books to your basket before checking out.
        </p>
        <Link
          href="/browse"
          style={{
            display: 'inline-block',
            background: 'var(--color-action)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            padding: '11px 22px',
            borderRadius: 'var(--radius-pill)',
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
    gaEvent('begin_checkout', {
      currency: 'GBP',
      value: subtotal,
      items: items.map((it) => ({
        item_id: String(it.listingId),
        item_name: it.title,
        price: it.priceGbp,
        quantity: 1,
      })),
    })

    try {
      // Collect unique non-null bundleIds from basket items. Server
      // revalidates each (all members present + status='active') before
      // applying any discount; if a bundle no longer applies the
      // affected items charge at full price.
      const bundleIds = Array.from(
        new Set(
          items
            .map((it) => it.bundleId)
            .filter((b): b is number => typeof b === 'number'),
        ),
      )

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-order-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingIds: items.map((it) => it.listingId),
          bundleIds: bundleIds.length > 0 ? bundleIds : undefined,
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
        <p style={{ fontSize: 14, color: 'var(--color-ink-soft)' }}>Order placed — redirecting to confirmation…</p>
      </div>
    )
  }

  // ----- initial form -----
  return (
    <div>
      <h1 style={{ fontSize: 22, color: FOREST_DEEP, fontWeight: 600, margin: 0 }}>
        Checkout
      </h1>
      <p style={{ fontSize: 13, color: 'var(--color-ink-soft)', margin: '4px 0 20px' }}>
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
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-notice-ink)', marginBottom: 6 }}>
            Some items are no longer available
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-notice-ink)', listStyle: 'disc' }}>
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
              background: 'var(--color-action)',
              color: CREAM,
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              padding: '8px 14px',
              borderRadius: 'var(--radius-pill)',
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
            background: submitting ? 'var(--color-ink-faint)' : 'var(--color-action)',
            color: CREAM,
            border: 'none',
            fontSize: 15,
            fontWeight: 600,
            padding: '13px 0',
            borderRadius: 'var(--radius-pill)',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Setting up payment…' : 'Continue to payment'}
        </button>
        <p style={{ fontSize: 11, color: 'var(--color-ink-faint)', textAlign: 'center', marginTop: 10 }}>
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
          background: submitting ? 'var(--color-ink-faint)' : 'var(--color-action)',
          color: CREAM,
          border: 'none',
          fontSize: 15,
          fontWeight: 600,
          padding: '13px 0',
          borderRadius: 'var(--radius-pill)',
          cursor: submitting ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? 'Processing…' : 'Pay now'}
      </button>
      <p style={{ fontSize: 11, color: 'var(--color-ink-faint)', textAlign: 'center', marginTop: 10 }}>
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
        border: '1px solid var(--color-rule)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
        marginBottom: 20,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: FOREST_DEEP, marginBottom: 12 }}>
        Order summary
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, idx) => (
          <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-ink)' }}>
            <span style={{ flex: 1, paddingRight: 8 }}>
              {it.title}
              {it.author ? ` · ${it.author}` : ''}
            </span>
            <span style={{ color: 'var(--color-ink)' }}>£{it.priceGbp.toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <div style={{ borderTop: '1px solid var(--color-rule)', marginTop: 12, paddingTop: 12 }}>
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
        <div style={{ borderTop: '1px solid var(--color-rule)', marginTop: 10, paddingTop: 10 }}>
          <Row label={<strong>Total</strong>} value={<strong>£{total.toFixed(2)}</strong>} />
        </div>
        {weightG && weightG > SOFT_CAP_WEIGHT_G && (
          <p style={{ fontSize: 11, color: 'var(--color-notice-strong)', marginTop: 8 }}>
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
        <span style={{ fontSize: 14, color: 'var(--color-ink)' }}>{label}</span>
        <span style={{ fontSize: 14, color: highlight ? GOLD : 'var(--color-ink)', fontWeight: highlight ? 600 : 400 }}>
          {value}
        </span>
      </div>
      {hint && <div style={{ fontSize: 12, color: 'var(--color-ink-faint)', marginTop: 2 }}>{hint}</div>}
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
      <div style={{ fontSize: 13, color: 'var(--color-ink-soft)', marginBottom: 6 }}>{label}</div>
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
          borderRadius: 'var(--radius-md)',
          background: '#fff',
          border: '1px solid var(--color-rule)',
          color: 'var(--color-ink)',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
      {hint && <div style={{ fontSize: 11, color: 'var(--color-ink-faint)', marginTop: 4 }}>{hint}</div>}
    </label>
  )
}

function ConfigError({ message }: { message: string }) {
  return (
    <div style={{ padding: 24, background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-line)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-danger-ink)', marginBottom: 6 }}>
        Checkout misconfigured
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-danger-strong)', margin: 0 }}>{message}</p>
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
  background: 'var(--color-danger-bg)',
  border: '1px solid var(--color-danger-line)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  color: 'var(--color-danger-ink)',
}

const staleBoxStyle: React.CSSProperties = {
  background: 'var(--color-notice-bg)',
  border: '1px solid var(--color-notice-line)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 14px',
  marginTop: 16,
}
