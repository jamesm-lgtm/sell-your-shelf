'use client'

import { useState, useEffect, FormEvent } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { getOrCreateSessionId } from '@/app/lib/session'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter',  test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number',            test: (p: string) => /[0-9]/.test(p) },
]

type ListingData = {
  id: number
  title: string
  author: string | null
  asking_price_gbp: number
  condition: string
  cover_url: string | null
  cover_url_hosted?: string | null
  username: string | null
}

type Props = {
  listing: ListingData
}

const inputBase: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8,
  background: '#fff', color: '#1A1A1A',
  outline: 'none', boxSizing: 'border-box' as const,
  transition: 'border-color 0.15s',
}

function getInputStyle(touched: boolean, valid: boolean): React.CSSProperties {
  if (!touched) return { ...inputBase, border: '0.5px solid #E5E3DF' }
  if (valid) return { ...inputBase, border: '1.5px solid #16A34A' }
  return { ...inputBase, border: '1.5px solid #DC2626' }
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: '2px solid #E5E3DF', borderTopColor: '#2D4A3E',
      borderRadius: '50%', animation: 'spin 0.6s linear infinite',
    }} />
  )
}

function TrustStrip() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '12px 0', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        <span style={{ fontSize: 11, color: '#666' }}>Secure checkout</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/></svg>
        <span style={{ fontSize: 11, color: '#666' }}>Tracked delivery</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        <span style={{ fontSize: 11, color: '#666' }}>Buyer protection</span>
      </div>
    </div>
  )
}

export default function CheckoutForm({ listing }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [postcode, setPostcode] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Email recognition: null = not checked, true = existing, false = new
  const [isExistingUser, setIsExistingUser] = useState<boolean | null>(null)
  const [emailChecking, setEmailChecking] = useState(false)

  // Username availability
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [usernameChecking, setUsernameChecking] = useState(false)

  // Terms of Service
  const [tosAccepted, setTosAccepted] = useState(false)

  // Track which fields have been touched (blurred)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const markTouched = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  useEffect(() => {
    setSessionId(getOrCreateSessionId())
  }, [])

  // Debounced email existence check
  useEffect(() => {
    const emailValid = /.+@.+\..+/.test(email)
    if (!emailValid) {
      setIsExistingUser(null)
      return
    }

    setEmailChecking(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/users?select=id&email=eq.${encodeURIComponent(email)}&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        )
        const data = await res.json()
        setIsExistingUser(Array.isArray(data) && data.length > 0)
      } catch {
        setIsExistingUser(null)
      } finally {
        setEmailChecking(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [email])

  // Debounced username availability check
  useEffect(() => {
    if (username.length < 3) {
      setUsernameAvailable(null)
      return
    }

    setUsernameChecking(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/users?select=id&username=eq.${encodeURIComponent(username)}&limit=1`,
          {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        )
        const data = await res.json()
        setUsernameAvailable(Array.isArray(data) && data.length === 0)
      } catch {
        setUsernameAvailable(null)
      } finally {
        setUsernameChecking(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [username])

  const isNewUser = isExistingUser === false
  const price = listing.asking_price_gbp
  const shipping = 2.50
  const total = price + shipping
  const condColor = CONDITION_COLORS[listing.condition] ?? CONDITION_COLORS.acceptable

  // Validation
  const emailValid = /.+@.+\..+/.test(email)
  const usernameValid = username.length >= 3 && usernameAvailable === true
  const passwordStrength = PASSWORD_RULES.map(rule => ({ ...rule, passed: rule.test(password) }))
  const passwordValid = passwordStrength.every(r => r.passed)
  const confirmValid = confirmPassword.length > 0 && password === confirmPassword
  const firstNameValid = firstName.trim().length > 0
  const lastNameValid = lastName.trim().length > 0
  const line1Valid = line1.trim().length > 0
  const cityValid = city.trim().length > 0
  const postcodeValid = postcode.trim().length > 0

  // Form validity depends on whether it's a new or existing user
  const accountValid = isExistingUser === null
    ? false // email not checked yet
    : isExistingUser
      ? emailValid && password.length > 0 // existing: just email + password
      : emailValid && usernameValid && passwordValid && confirmValid && tosAccepted // new: full signup

  const formValid =
    accountValid &&
    firstNameValid &&
    lastNameValid &&
    line1Valid &&
    cityValid &&
    postcodeValid

  const handleCreatePaymentIntent = async () => {
    // Touch all fields to show validation
    const allTouched: Record<string, boolean> = {
      email: true, password: true,
      firstName: true, lastName: true, line1: true, city: true, postcode: true,
    }
    if (isNewUser) {
      allTouched.username = true
      allTouched.confirmPassword = true
    }
    setTouched(allTouched)

    if (!formValid) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/web-create-payment-intent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listingId: listing.id,
            email,
            username: isNewUser ? username : undefined,
            password,
            isExistingUser: isExistingUser || false,
            shippingAddress: { firstName, lastName, fullName: `${firstName.trim()} ${lastName.trim()}`, line1, line2: line2 || undefined, city, postcode },
            sessionId: sessionId || undefined,
          }),
        }
      )

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')

      setClientSecret(data.clientSecret)
      setPaymentIntentId(data.paymentIntentId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* 1. Order summary */}
      <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 60, borderRadius: 6, overflow: 'hidden', background: '#2D4A3E', aspectRatio: '2/3', flexShrink: 0 }}>
            {(listing.cover_url_hosted || listing.cover_url) ? (
              <img src={listing.cover_url_hosted || listing.cover_url!} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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

        {/* Email */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Email</label>
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onBlur={() => markTouched('email')}
              placeholder="you@example.com"
              style={{
                ...getInputStyle(touched.email && email.length > 0, emailValid),
                paddingRight: 40,
              }}
            />
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
              {emailChecking && <Spinner size={16} />}
              {!emailChecking && isExistingUser === true && emailValid && <CheckIcon />}
            </span>
          </div>
          {touched.email && email.length > 0 && !emailValid && (
            <p style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Please enter a valid email address</p>
          )}
          {isExistingUser === true && (
            <p style={{ fontSize: 11, color: '#16A34A', marginTop: 4 }}>Welcome back! Enter your password to continue.</p>
          )}
          {isExistingUser === false && emailValid && (
            <p style={{ fontSize: 11, color: '#2D4A3E', marginTop: 4 }}>New account — choose a username and password below.</p>
          )}
        </div>

        {/* Username — only for new users */}
        {isNewUser && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Username</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                onBlur={() => markTouched('username')}
                placeholder="yourname"
                maxLength={30}
                style={{
                  ...getInputStyle(
                    touched.username && username.length > 0,
                    usernameValid
                  ),
                  paddingRight: 40,
                }}
              />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                {usernameChecking && <Spinner size={16} />}
                {!usernameChecking && usernameAvailable === true && <CheckIcon />}
                {!usernameChecking && usernameAvailable === false && <XIcon />}
              </span>
            </div>
            {touched.username && username.length > 0 && username.length < 3 && (
              <p style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Username must be at least 3 characters</p>
            )}
            {usernameAvailable === false && (
              <p style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>That username is already taken</p>
            )}
            {usernameAvailable === true && (
              <p style={{ fontSize: 11, color: '#16A34A', marginTop: 4 }}>Username available</p>
            )}
          </div>
        )}

        {/* Password — always shown once email is recognised */}
        {isExistingUser !== null && (
          <>
            <div style={{ marginBottom: isNewUser ? 4 : 8 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onBlur={() => markTouched('password')}
                  style={{
                    ...getInputStyle(
                      touched.password && password.length > 0,
                      isNewUser ? passwordValid : password.length > 0
                    ),
                    paddingRight: 60,
                  }}
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

            {/* Password strength checklist — only for new users */}
            {isNewUser && password.length > 0 && (
              <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {passwordStrength.map((rule, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {rule.passed ? <CheckIcon /> : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                    )}
                    <span style={{ fontSize: 11, color: rule.passed ? '#16A34A' : '#999' }}>{rule.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Confirm password — only for new users */}
            {isNewUser && (
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onBlur={() => markTouched('confirmPassword')}
                  style={getInputStyle(touched.confirmPassword && confirmPassword.length > 0, confirmValid)}
                />
                {touched.confirmPassword && confirmPassword.length > 0 && !confirmValid && (
                  <p style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Passwords do not match</p>
                )}
              </div>
            )}

            {/* Terms of Service — only for new users */}
            {isNewUser && (
              <div
                onClick={() => setTosAccepted(!tosAccepted)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 12, marginBottom: 8, cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 1,
                  border: tosAccepted ? '2px solid #2D4A3E' : '2px solid #E5E3DF',
                  background: tosAccepted ? '#2D4A3E' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {tosAccepted && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>
                  I agree to the{' '}
                  <a href="https://sellyourshelf.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#2D4A3E', textDecoration: 'underline' }} onClick={e => e.stopPropagation()}>Terms of Service</a>
                  {' '}and{' '}
                  <a href="https://sellyourshelf.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#2D4A3E', textDecoration: 'underline' }} onClick={e => e.stopPropagation()}>Privacy Policy</a>
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. Delivery address */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 14 }}>Delivery address</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>First name</label>
            <input
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              onBlur={() => markTouched('firstName')}
              style={getInputStyle(touched.firstName && firstName.length > 0, firstNameValid)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Last name</label>
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              onBlur={() => markTouched('lastName')}
              style={getInputStyle(touched.lastName && lastName.length > 0, lastNameValid)}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Address line 1</label>
          <input
            type="text"
            value={line1}
            onChange={e => setLine1(e.target.value)}
            onBlur={() => markTouched('line1')}
            style={getInputStyle(touched.line1 && line1.length > 0, line1Valid)}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Address line 2 <span style={{ color: '#bbb' }}>(optional)</span></label>
          <input type="text" value={line2} onChange={e => setLine2(e.target.value)} style={{ ...inputBase, border: '0.5px solid #E5E3DF' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>City</label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              onBlur={() => markTouched('city')}
              style={getInputStyle(touched.city && city.length > 0, cityValid)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6 }}>Postcode</label>
            <input
              type="text"
              value={postcode}
              onChange={e => setPostcode(e.target.value)}
              onBlur={() => markTouched('postcode')}
              style={getInputStyle(touched.postcode && postcode.length > 0, postcodeValid)}
            />
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

            <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
              Enter your details above, then tap Pay to securely enter your card details via Stripe.
            </p>
          </>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: 'stripe' } }}
          >
            <PaymentStep
              clientSecret={clientSecret}
              paymentIntentId={paymentIntentId!}
              total={total}
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
              disabled={loading}
              style={{
                width: '100%', padding: '14px', fontSize: 15, fontWeight: 600, borderRadius: 8,
                border: 'none', cursor: !loading ? 'pointer' : 'default',
                background: formValid && !loading ? '#2D4A3E' : '#ccc', color: '#FAF8F5',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              ) : (
                `Pay \u00A3${total.toFixed(2)}`
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
  paymentIntentId,
  total,
}: {
  clientSecret: string
  paymentIntentId: string
  total: number
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
        return_url: `https://sellyourshelf.com/order/confirmed?payment_intent=${paymentIntentId}`,
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
              `Pay \u00A3${total.toFixed(2)}`
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
