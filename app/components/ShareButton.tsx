'use client'

/**
 * ShareButton — the one share affordance, used on bundles, shelves,
 * listings and book pages.
 *
 * Placement rule: share is page *utility*, not page action. It sits at
 * the right edge of the page's top identity row (breadcrumbs on a
 * listing or book page, the @username row on a shelf) — never stacked
 * into the buy column, where a third identically-shaped pill would
 * dilute Add to basket. The bundle hero is the one exception: it has no
 * utility row, so share stays full-size in the card.
 *
 * Uses the Web Share API when available (iOS Safari, Android Chrome,
 * most modern browsers) so the native share sheet pops up. Falls
 * back to copy-link with a transient "Copied!" pill when the API
 * isn't supported (desktop Chrome/Firefox in many cases). Both
 * flows give the buyer a way to send the bundle URL to someone.
 */

import { useState } from 'react'

interface Props {
  url: string
  title: string
  description?: string | null
  /** What is being shared, for the label and the fallback share text. */
  kind?: 'bundle' | 'shelf' | 'book'
  /** Utility-row size: sits beside breadcrumbs without outweighing them. */
  compact?: boolean
}

export default function ShareButton({ url, title, description, kind = 'bundle', compact = false }: Props) {
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
      text:
        description ??
        (kind === 'shelf'
          ? `Have a look at ${title} on Sell Your Shelf`
          : `Check out ${title} on Sell Your Shelf`),
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
      className="sy-cta sy-cta-quiet sy-share"
      style={compact ? { fontSize: 13, padding: '7px 14px', gap: 7 } : { fontSize: 14, padding: '11px 20px' }}
    >
      {/* Drawn, not an emoji — craft-floor bans glyphs standing in for icons. */}
      <svg width={compact ? 13 : 15} height={compact ? 13 : 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {copied ? (
          <path d="M20 6L9 17l-5-5" />
        ) : (
          <>
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
            <path d="M16 6l-4-4-4 4" />
            <path d="M12 2v13" />
          </>
        )}
      </svg>
      <span className="sy-share-label">
        {copied ? 'Link copied' : error ? 'Try again' : `Share ${kind}`}
      </span>
    </button>
  )
}
