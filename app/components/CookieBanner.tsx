'use client'

// Minimal analytics-consent banner (UK PECR: analytics cookies are
// opt-in). GA loads with consent defaulted to denied (cookieless pings
// only); accepting updates consent mode and persists the choice.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CONSENT_KEY, gaGrantConsent } from '@/app/lib/ga'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setVisible(true)
    } catch {
      // storage unavailable — leave banner hidden, consent stays denied
    }
  }, [])

  const choose = (granted: boolean) => {
    try {
      localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied')
    } catch {}
    if (granted) gaGrantConsent()
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 560,
        margin: '0 auto',
        background: '#FFFFFF',
        border: '1px solid rgba(11,11,11,0.12)',
        borderRadius: 12,
        boxShadow: '0 4px 24px rgba(11,11,11,0.12)',
        padding: '14px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
        zIndex: 1000,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--color-ink)', flex: '1 1 260px' }}>
        We use analytics cookies to understand how readers find books.{' '}
        <Link href="/privacy" style={{ color: 'var(--color-ground)', textDecoration: 'underline' }}>
          Privacy policy
        </Link>
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => choose(false)}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid rgba(11,11,11,0.15)',
            background: '#fff',
            color: 'var(--color-ink)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          No thanks
        </button>
        <button
          onClick={() => choose(true)}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--color-action)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Accept
        </button>
      </div>
    </div>
  )
}
