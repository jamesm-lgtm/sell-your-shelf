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

export default function CheckoutForm({ listing }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [transactionId, setTransactionId] = useState<number | null>(null)

  // Form fields
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
            shippingAddress: {
              fullName,
              line1,
              line2: line2 || undefined,
              city,
              postcode,
            },
          }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      setClientSecret(data.clientSecret)
      setTransactionId(data.transactionId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const condColor = CONDITION_COLORS[listing.condition] ?? CONDITION_COLORS.acceptable

  return (
    <div>
      {/* Section 1: Account */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 16 }}>Account</h2>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8,
              border: '0.5px solid #E5E3DF', background: '#fff', color: '#1A1A1A',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              style={{
                width: '100%', padding: '10px 14px', paddingRight: 60, fontSize: 14, borderRadius: 8,
                border: '0.5px solid #E5E3DF', background: '#fff', color: '#1A1A1A',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                fontSize: 12, color: '#2D4A3E', background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <p style={{ fontSize: 12, color: '#999', lineHeight: 1.5 }}>
          We&apos;ll create your Sell Your Shelf account so you can track your order.
          If you already have an account, use the same email and password.
        </p>
      </div>

      {/* Section 2: Delivery address */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 16 }}>Delivery address</h2>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8,
              border: '0.5px solid #E5E3DF', background: '#fff', color: '#1A1A1A',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Address line 1</label>
          <input
            type="text"
            value={line1}
            onChange={e => setLine1(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8,
              border: '0.5px solid #E5E3DF', background: '#fff', color: '#1A1A1A',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Address line 2 <span style={{ color: '#999' }}>(optional)</span></label>
          <input
            type="text"
            value={line2}
            onChange={e => setLine2(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8,
              border: '0.5px solid #E5E3DF', background: '#fff', color: '#1A1A1A',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>City</label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8,
                border: '0.5px solid #E5E3DF', background: '#fff', color: '#1A1A1A',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Postcode</label>
            <input
              type="text"
              value={postcode}
              onChange={e => setPostcode(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8,
                border: '0.5px solid #E5E3DF', background: '#fff', color: '#1A1A1A',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* Section 3: Payment */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 16 }}>Payment</h2>

        {!clientSecret ? (
          <>
            {/* Order summary before payment */}
            <OrderSummary listing={listing} condColor={condColor} shipping={shipping} total={total} />

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              onClick={handleCreatePaymentIntent}
              disabled={!formValid || loading}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 8,
                border: 'none',
                cursor: formValid && !loading ? 'pointer' : 'default',
                background: formValid && !loading ? '#2D4A3E' : '#ccc',
                color: '#FAF8F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              ) : (
                `Pay £${price.toFixed(2)}`
              )}
            </button>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: 'stripe' } }}
          >
            <PaymentStep
              clientSecret={clientSecret}
              transactionId={transactionId!}
              listing={listing}
              condColor={condColor}
              shipping={shipping}
              total={total}
              price={price}
            />
          </Elements>
        )}
      </div>
    </div>
  )
}

function OrderSummary({
  listing,
  condColor,
  shipping,
  total,
}: {
  listing: ListingData
  condColor: { bg: string; text: string }
  shipping: number
  total: number
}) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
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
          <span style={{ fontSize: 13, color: '#1A1A1A' }}>£{listing.asking_price_gbp.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: '#666' }}>Shipping</span>
          <span style={{ fontSize: 13, color: '#1A1A1A' }}>£{shipping.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '0.5px solid #E5E3DF', paddingTop: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>Total</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#2D4A3E' }}>£{total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

function PaymentStep({
  clientSecret,
  transactionId,
  listing,
  condColor,
  shipping,
  total,
  price,
}: {
  clientSecret: string
  transactionId: number
  listing: ListingData
  condColor: { bg: string; text: string }
  shipping: number
  total: number
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
    // If no error, Stripe redirects — no need to handle success here
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 20 }}>
        <PaymentElement />
      </div>

      <OrderSummary listing={listing} condColor={condColor} shipping={shipping} total={total} />

      {payError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{payError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || paying}
        style={{
          width: '100%',
          padding: '14px',
          fontSize: 15,
          fontWeight: 600,
          borderRadius: 8,
          border: 'none',
          cursor: !paying ? 'pointer' : 'default',
          background: !paying ? '#2D4A3E' : '#ccc',
          color: '#FAF8F5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {paying ? (
          <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        ) : (
          `Pay £${price.toFixed(2)}`
        )}
      </button>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  )
}
