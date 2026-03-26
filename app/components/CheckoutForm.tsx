'use client'

import { useState, FormEvent } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

const CONDITIONS: Record<string, string> = {
  like_new: 'Like New',
  very_good: 'Very Good',
  good: 'Good',
  acceptable: 'Acceptable',
}

const CONDITION_COLORS: Record<string, { bg: string; text: string }> = {
  like_new: { bg: '#DCFCE7', text: '#166534' },
  very_good: { bg: '#DBEAFE', text: '#1E40AF' },
  good: { bg: '#FEF9C3', text: '#854D0E' },
  acceptable: { bg: '#F3F4F6', text: '#374151' },
}

type ListingData = {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  condition: string
  cover_url: string | null
  username: string | null
}

type Props = {
  listing: ListingData
}

const inputStyle = {
  width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8,
  border: '0.5px solid #E5E3DF', background: '#fff', color: '#1A1A1A',
  outline: 'none', boxSizing: 'border-box' as const,
}

function TrustStrip() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '12px 0', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        <span style={{ fontSize: 11, color: '#666' }}>Secure checkout</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
        <span style={{ fontSize: 11, color: '#666' }}>Tracked delivery</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: '#666' }}>Powered by</span>
        <svg width="36" height="15" viewBox="0 0 60 25" fill="#635BFF"><path d="M5 11.2C5 9.9 6 9.3 7.6 9.3c2 0 4.5.6 6.5 1.7V5.6C12 4.8 10 4.4 7.6 4.4 3 4.4 0 6.8 0 10.8c0 6.3 8.7 5.3 8.7 8 0 1.5-1.3 2-3.1 2-2.7 0-6.1-1.1-8.6-2.6v5.5c2.8 1.2 5.6 1.7 8.6 1.7 5.3 0 8.9-2.6 8.9-6.7C14.5 12.4 5 13.7 5 11.2zm14.8-7.5l-4.6 1-.1 16.8c0 3.1 2.3 5.4 5.4 5.4 1.7 0 3-.3 3.7-.7v-4.3c-.6.3-3.9 1.2-3.9-1.8V12h3.9V7.4h-3.9l-.5-3.7zM29 8.6l-.3-1.2h-4.3v18h4.9V13c1.2-1.5 3.1-1.2 3.7-1V7.4c-.7-.2-3.1-.7-4 1.2zm5.4-1.2h4.9v18h-4.9V7.4zm0-1.5l4.9-1V.4l-4.9 1v4.5zM48 4.4c-1.8 0-3 .8-3.6 1.4l-.3-1.1h-4.3V30l4.9-1v-5.5c.7.5 1.7 1.2 3.4 1.2 3.4 0 6.5-2.8 6.5-8.8-.1-5.6-3.2-8.3-6.6-8.3v-4.2zm-1.1 16.1c-1.1 0-1.8-.4-2.3-1l-.1-7.8c.5-.6 1.2-1 2.4-1 1.8 0 3.1 2 3.1 4.9 0 2.8-1.2 4.9-3.1 4.9zM60.6 16c0-5.8-2.8-10.3-8.1-10.3-5.3 0-8.6 4.5-8.6 10.3 0 6.8 3.8 10.2 9.3 10.2 2.7 0 4.7-.6 6.2-1.5v-4c-1.5.8-3.3 1.3-5.5 1.3-2.2 0-4-.8-4.3-3.4h10.8c0-.3.2-1.5.2-2.6zm-10.9-2.1c0-2.5 1.5-3.6 2.9-3.6s2.8 1.1 2.8 3.6h-5.7z"/></svg>
      </div>
    </div>
  )
}

function CardLogos() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }}>
      {/* Visa */}
      <div style={{ background: '#fff', border: '1px solid #E5E3DF', borderRadius: 4, padding: '4px 8px', fontSize: 10, fontWeight: 700, color: '#1A1F71' }}>VISA</div>
      {/* Mastercard */}
      <div style={{ background: '#fff', border: '1px solid #E5E3DF', borderRadius: 4, padding: '4px 8px', display: 'flex', gap: 2 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EB001B', opacity: 0.9 }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F79E1B', opacity: 0.9, marginLeft: -4 }} />
      </div>
      {/* Amex */}
      <div style={{ background: '#fff', border: '1px solid #E5E3DF', borderRadius: 4, padding: '4px 8px', fontSize: 10, fontWeight: 700, color: '#006FCF' }}>AMEX</div>
    </div>
  )
}

export default function CheckoutForm({ listing }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [transactionId, setTransactionId] = useState<number | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const price = listing.asking_price_gbp
  const shipping = 2.69
  const total = price + shipping
  const condColor = CONDITION_COLORS[listing.condition] ?? CONDITION_COLORS.acceptable

  const formValid =
    email.length > 0 &&
    password.length >= 8 &&
    fullName.length > 0 &&
    line1.length > 0 &&
    city.length > 0 &&
    postcode.length > 0

  const handleCreatePaymentIntent = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/web-create-payment-intent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listingId: listing.id,
            email,
            password,
            shippingAddress: { fullName, line1, line2: line2 || undefined, city, postcode },
          }),
        }
      )

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')

      setClientSecret(data.clientSecret)
      setTransactionId(data.transactionId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 1. Order summary — show what they're buying first */}
      <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 60, borderRadius: 6, overflow: 'hidden', background: '#2D4A3E', aspectRatio: '2/3', flexShrink: 0 }}>
            {listing.cover_url ? (
              <img src={listing.cover_url} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, textAlign: 'center', padding: 4 }}>{listing.title}</span>
              </div>
            )}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>{listing.title}</p>
            {listing.author && <p style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>by {listing.author}</p>}
            <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4, background: condColor.bg, color: condColor.text }}>
              {CONDITIONS[listing.condition] ?? listing.condition}
            </span>
            {listing.username && (
              <p style={{ fontSize: 12, color: '#999', marginTop: 6 }}>Seller: @{listing.username}</p>
            )}
          </div>
        </div>

        <div style={{ borderTop: '0.5px solid #E5E3DF', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#666' }}>Book price</span>
            <span style={{ fontSize: 13, color: '#1A1A1A' }}>{'\u00A3'}{price.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#666' }}>
              Shipping <span style={{ color: '#999', fontSize: 11 }}>(2-4 working days)</span>
            </span>
            <span style={{ fontSize: 13, color: '#1A1A1A' }}>{'\u00A3'}{shipping.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '0.5px solid #E5E3DF', paddingTop: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>Total</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#2D4A3E' }}>{'\u00A3'}{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Trust strip */}
      <TrustStrip />

      {/* 2. Account */}
      <div style={{ marginTop: 24, marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 14 }}>Account</h2>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              style={{ ...inputStyle, paddingRight: 60 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#2D4A3E', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <p style={{ fontSize: 11, color: '#999', lineHeight: 1.5 }}>
          We&apos;ll create your Sell Your Shelf account so you can track your order.
          Already have an account? Use the same email and password.
        </p>
      </div>

      {/* 3. Delivery address */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 14 }}>Delivery address</h2>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Full name</label>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Address line 1</label>
          <input type="text" value={line1} onChange={e => setLine1(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Address line 2 <span style={{ color: '#bbb' }}>(optional)</span></label>
          <input type="text" value={line2} onChange={e => setLine2(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>City</label>
            <input type="text" value={city} onChange={e => setCity(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Postcode</label>
            <input type="text" value={postcode} onChange={e => setPostcode(e.target.value)} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* 4. Payment */}
      <div style={{ marginBottom: 120 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 14 }}>Payment</h2>

        {!clientSecret ? (
          <>
            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{error}</p>
              </div>
            )}

            <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
              Your card details are collected securely by Stripe. We never see or store your card number.
            </p>

            <CardLogos />
          </>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: 'stripe' } }}
          >
            <PaymentStep
              clientSecret={clientSecret}
              transactionId={transactionId!}
              price={price}
            />
          </Elements>
        )}
      </div>

      {/* Sticky pay button */}
      {!clientSecret && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#FAF8F5', borderTop: '1px solid #E5E3DF',
          padding: '12px 24px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          zIndex: 50,
        }}>
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <button
              onClick={handleCreatePaymentIntent}
              disabled={!formValid || loading}
              style={{
                width: '100%', padding: '14px', fontSize: 15, fontWeight: 600, borderRadius: 8,
                border: 'none', cursor: formValid && !loading ? 'pointer' : 'default',
                background: formValid && !loading ? '#2D4A3E' : '#ccc', color: '#FAF8F5',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              ) : (
                `Pay \u00A3${price.toFixed(2)}`
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PaymentStep({
  clientSecret,
  transactionId,
  price,
}: {
  clientSecret: string
  transactionId: number
  price: number
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setPaying(true)
    setPayError(null)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `https://sellyourshelf.com/order/confirmed?transaction_id=${transactionId}`,
      },
    })

    if (error) {
      setPayError(error.message ?? 'Payment failed')
      setPaying(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 20 }}>
        <PaymentElement />
      </div>

      {payError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{payError}</p>
        </div>
      )}

      {/* Sticky pay button for payment step */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#FAF8F5', borderTop: '1px solid #E5E3DF',
        padding: '12px 24px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <button
            type="submit"
            disabled={!stripe || paying}
            style={{
              width: '100%', padding: '14px', fontSize: 15, fontWeight: 600, borderRadius: 8,
              border: 'none', cursor: !paying ? 'pointer' : 'default',
              background: !paying ? '#2D4A3E' : '#ccc', color: '#FAF8F5',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {paying ? (
              <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
            ) : (
              `Pay \u00A3${price.toFixed(2)}`
            )}
          </button>
          <p style={{ fontSize: 10, color: '#999', textAlign: 'center', marginTop: 6 }}>
            Secure payment powered by Stripe
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  )
}
