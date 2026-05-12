'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useBasket, useBasketShipping } from './BasketProvider'
import {
  FREE_SHIPPING_THRESHOLD_GBP,
  LARGE_PARCEL_FEE_GBP,
  UNLOCK_FLASH_FLAG,
} from '@/app/lib/basket'

const FOREST = '#2D4A3E'
const FOREST_DEEP = '#1F3329'
const CREAM = '#FAF8F5'
const GOLD = '#C9A961'

export default function BasketWidget() {
  const { basket, itemCount } = useBasket()
  const { state, subtotal } = useBasketShipping()

  const [flash, setFlash] = useState(false)
  const prevUnlockedRef = useRef(false)

  // Trigger the celebratory flash the FIRST time the user flips from below→unlocked in a session.
  useEffect(() => {
    const isUnlocked = state.kind === 'unlocked'
    const wasUnlocked = prevUnlockedRef.current
    prevUnlockedRef.current = isUnlocked
    if (!isUnlocked || wasUnlocked) return
    if (typeof window === 'undefined') return
    try {
      const alreadyFlashed = window.sessionStorage.getItem(UNLOCK_FLASH_FLAG)
      if (alreadyFlashed) return
      window.sessionStorage.setItem(UNLOCK_FLASH_FLAG, '1')
    } catch {
      // sessionStorage disabled — still allow one flash per mount, no harm.
    }
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 1400)
    return () => clearTimeout(t)
  }, [state.kind])

  if (!basket || state.kind === 'empty') return null

  return (
    <>
      <style>{flashKeyframes}</style>
      <div data-sys-basket-widget style={containerStyle}>
        <div style={cardStyle(flash)}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: CREAM }}>
                {itemCount} {itemCount === 1 ? 'book' : 'books'}
              </span>
              <span style={{ fontSize: 12, color: 'rgba(250,248,245,0.7)' }}>
                @{basket.sellerUsername}
              </span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 600, color: CREAM }}>
              £{subtotal.toFixed(2)}
            </span>
          </div>

          {/* Progress / message */}
          {state.kind === 'below' && (
            <>
              <ProgressBar pct={state.progressPct} />
              <div style={messageBelowStyle}>
                Add <strong style={{ color: GOLD }}>£{state.gapGbp.toFixed(2)}</strong> for free shipping
              </div>
            </>
          )}

          {state.kind === 'unlocked' && (
            <>
              <ProgressBar pct={100} unlocked />
              <div style={messageUnlockedStyle}>
                <span aria-hidden style={{ marginRight: 6 }}>✓</span>
                Free shipping unlocked
              </div>
            </>
          )}

          {state.kind === 'oversize' && (
            <div style={messageOversizeStyle}>
              Larger parcel — £{LARGE_PARCEL_FEE_GBP.toFixed(2)} shipping
            </div>
          )}

          {/* CTA */}
          <Link
            href="/basket"
            style={ctaStyle(state.kind === 'unlocked')}
          >
            {state.kind === 'unlocked' ? 'Checkout' : 'View basket'}
          </Link>
        </div>
      </div>

      <CrossSellerModal />
    </>
  )
}

function ProgressBar({ pct, unlocked = false }: { pct: number; unlocked?: boolean }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${Math.round(pct)}% to free shipping`}
      style={{
        height: 6,
        borderRadius: 999,
        background: 'rgba(250,248,245,0.18)',
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: unlocked ? GOLD : `linear-gradient(90deg, ${GOLD} 0%, #E5C988 100%)`,
          transition: 'width 360ms cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: unlocked ? '0 0 12px rgba(201,169,97,0.55)' : 'none',
        }}
      />
    </div>
  )
}

// ---------- Cross-seller modal ----------

function CrossSellerModal() {
  const { conflict, dismissConflict, clearBasket } = useBasket()

  if (!conflict) return null

  const { attempt, currentSeller } = conflict
  const currentCount = (() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem('sys:basket:v1')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed?.items?.length ?? null
    } catch {
      return null
    }
  })()

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31,51,41,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={dismissConflict}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: CREAM,
          borderRadius: 14,
          padding: '24px 22px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 600, color: FOREST_DEEP, marginBottom: 10 }}>
          One seller at a time
        </div>
        <p style={{ fontSize: 14, color: '#333', lineHeight: 1.5, margin: 0 }}>
          You have{' '}
          {currentCount !== null ? (
            <strong>{currentCount} {currentCount === 1 ? 'book' : 'books'}</strong>
          ) : (
            <strong>books</strong>
          )}{' '}
          from <strong>@{currentSeller.sellerUsername}</strong> in your basket. To add from{' '}
          <strong>@{attempt.seller.sellerUsername}</strong>, you'll need to checkout your current basket
          or clear it.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
          <Link
            href="/basket"
            onClick={dismissConflict}
            style={{
              background: FOREST,
              color: CREAM,
              fontSize: 14,
              fontWeight: 500,
              padding: '11px 16px',
              borderRadius: 8,
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            Checkout @{currentSeller.sellerUsername}'s books
          </Link>
          <button
            onClick={() => {
              clearBasket()
              dismissConflict()
            }}
            style={{
              background: '#fff',
              color: FOREST,
              fontSize: 14,
              fontWeight: 500,
              padding: '11px 16px',
              borderRadius: 8,
              border: `1px solid ${FOREST}`,
              cursor: 'pointer',
            }}
          >
            Clear basket
          </button>
          <button
            onClick={dismissConflict}
            style={{
              background: 'transparent',
              color: '#666',
              fontSize: 13,
              padding: '8px 16px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- styles ----------

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 900,
  // Desktop: top-right. Mobile: bottom centred. We use a CSS media query via inline <style>.
  bottom: 16,
  left: 16,
  right: 16,
  pointerEvents: 'none',
}

const cardStyle = (flash: boolean): React.CSSProperties => ({
  pointerEvents: 'auto',
  background: FOREST_DEEP,
  borderRadius: 14,
  padding: '14px 16px 14px 16px',
  boxShadow: flash
    ? '0 0 0 3px rgba(201,169,97,0.55), 0 20px 50px rgba(0,0,0,0.32)'
    : '0 14px 40px rgba(0,0,0,0.25)',
  border: `1px solid rgba(250,248,245,0.08)`,
  maxWidth: 360,
  marginLeft: 'auto',
  animation: flash ? 'sys-basket-pop 700ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
})

const messageBelowStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'rgba(250,248,245,0.85)',
  marginBottom: 12,
}

const messageUnlockedStyle: React.CSSProperties = {
  fontSize: 13,
  color: GOLD,
  fontWeight: 600,
  marginBottom: 12,
}

const messageOversizeStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'rgba(250,248,245,0.85)',
  marginBottom: 12,
}

const ctaStyle = (unlocked: boolean): React.CSSProperties => ({
  display: 'block',
  textAlign: 'center',
  background: unlocked ? GOLD : CREAM,
  color: unlocked ? FOREST_DEEP : FOREST_DEEP,
  fontSize: 14,
  fontWeight: 600,
  padding: '10px 0',
  borderRadius: 8,
  textDecoration: 'none',
})

const flashKeyframes = `
@keyframes sys-basket-pop {
  0%   { transform: scale(1); }
  35%  { transform: scale(1.04); }
  70%  { transform: scale(0.995); }
  100% { transform: scale(1); }
}
@media (min-width: 720px) {
  [data-sys-basket-widget] {
    bottom: auto !important;
    top: 16px !important;
    left: auto !important;
    right: 16px !important;
  }
}
`
