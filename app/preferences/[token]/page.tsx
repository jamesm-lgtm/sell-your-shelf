'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Footer from '@/app/components/Footer'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/update-communication-preferences`

type Props = {
  params: Promise<{ token: string }>
}

export default function PreferencesPage({ params }: Props) {
  const { token } = use(params)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [emailOptIn, setEmailOptIn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    validateToken()
  }, [token])

  const validateToken = async () => {
    try {
      // The token encodes the userId as the first 36 chars (UUID) + HMAC
      // But our HMAC scheme needs the userId to verify. We'll extract it from
      // the token format: {userId}_{hmac}
      const separatorIndex = token.indexOf('_')
      if (separatorIndex === -1) {
        setError('Invalid link')
        setLoading(false)
        return
      }

      const tokenUserId = token.substring(0, separatorIndex)
      const hmac = token.substring(separatorIndex + 1)

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate', token: hmac, userId: tokenUserId }),
      })

      if (!res.ok) {
        setError('This link is invalid or has expired.')
        setLoading(false)
        return
      }

      const data = await res.json()
      setUserId(data.userId)
      setEmailOptIn(data.emailOptIn)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async () => {
    if (!userId) return
    const newValue = !emailOptIn
    setSaving(true)
    setSaved(false)

    const separatorIndex = token.indexOf('_')
    const hmac = token.substring(separatorIndex + 1)

    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', token: hmac, userId, emailOptIn: newValue }),
      })

      if (!res.ok) throw new Error('Failed to save')

      setEmailOptIn(newValue)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // Revert nothing — the UI already shows the old state
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#FAF8F5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ borderBottom: '0.5px solid #E5E3DF', background: '#FFFFFF' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#2D4A3E' }}>Sell Your Shelf</span>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, maxWidth: 520, margin: '0 auto', padding: '48px 24px', width: '100%' }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>
          Email Preferences
        </h1>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 32, lineHeight: 1.6 }}>
          Manage how we communicate with you.
        </p>

        {loading && (
          <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 10, padding: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#666' }}>Loading your preferences...</p>
          </div>
        )}

        {error && (
          <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 10, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>&#x26A0;&#xFE0F;</div>
            <p style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>
              {error}
            </p>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>
              If you believe this is a mistake, open the Sell Your Shelf app and go to Profile &gt; Settings to manage your preferences directly.
            </p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div style={{ background: '#fff', border: '0.5px solid #E5E3DF', borderRadius: 10, padding: 24, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>
                    Email updates
                  </p>
                  <p style={{ fontSize: 14, color: '#666', lineHeight: 1.5 }}>
                    Tips and updates about your books
                  </p>
                </div>

                {/* Toggle switch */}
                <button
                  onClick={handleToggle}
                  disabled={saving}
                  style={{
                    position: 'relative',
                    width: 50,
                    height: 28,
                    borderRadius: 14,
                    border: 'none',
                    cursor: saving ? 'wait' : 'pointer',
                    background: emailOptIn ? '#2D4A3E' : '#E5E3DF',
                    transition: 'background 0.2s ease',
                    flexShrink: 0,
                    padding: 0,
                    opacity: saving ? 0.6 : 1,
                  }}
                  aria-label={emailOptIn ? 'Unsubscribe from email updates' : 'Subscribe to email updates'}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: emailOptIn ? 25 : 3,
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: '#FFFFFF',
                      transition: 'left 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }}
                  />
                </button>
              </div>
            </div>

            {/* Save confirmation */}
            {saved && (
              <div style={{
                background: '#2D4A3E',
                color: '#FAF8F5',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'center',
                marginBottom: 16,
              }}>
                Preferences saved
              </div>
            )}

            <p style={{ fontSize: 13, color: '#999', lineHeight: 1.6 }}>
              You can also manage your preferences in the Sell Your Shelf app under Profile &gt; Settings.
            </p>
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}
