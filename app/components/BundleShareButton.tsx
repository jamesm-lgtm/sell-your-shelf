'use client'

/**
 * BundleShareButton — appears in the hero card on /bundle/[id].
 *
 * Uses the Web Share API when available (iOS Safari, Android Chrome,
 * most modern browsers) so the native share sheet pops up. Falls
 * back to copy-link with a transient "Copied!" pill when the API
 * isn't supported (desktop Chrome/Firefox in many cases). Both
 * flows give the buyer a way to send the bundle URL to someone.
 */

import { useState } from 'react'

const FOREST = '#2D4A3E'
const GOLD = '#C9A961'

interface Props {
  url: string
  title: string
  description?: string | null
}

export default function BundleShareButton({ url, title, description }: Props) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  const handleShare = async () => {
    setError(false)
    const shareData = {
      url,
      title,
      // The body of the share — most apps display title prominently
      // and text underneath. Description gives recipients a clue
      // what the bundle is.
      text: description ?? `Check out this bundle on Sell Your Shelf: ${title}`,
    }
    try {
      // Prefer native share sheet when available — gives the buyer
      // every app they have installed (Messages, WhatsApp, etc.).
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(shareData)
        return
      }
      // Fallback: copy-link.
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (err) {
      // AbortError is fired when the user dismisses the share sheet
      // — that's not a real error, ignore it. Anything else we
      // surface so the buyer knows the action didn't succeed.
      const name = err instanceof Error ? err.name : ''
      if (name === 'AbortError') return
      setError(true)
      setTimeout(() => setError(false), 1800)
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={`Share ${title}`}
      style={{
        background: copied ? FOREST : '#FFFDF6',
        color: copied ? '#FAF8F5' : FOREST,
        border: `1px solid ${GOLD}`,
        borderRadius: 8,
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      <span aria-hidden style={{ fontSize: 14 }}>
        {copied ? '✓' : error ? '⚠️' : '🔗'}
      </span>
      {copied ? 'Link copied' : error ? 'Try again' : 'Share bundle'}
    </button>
  )
}
