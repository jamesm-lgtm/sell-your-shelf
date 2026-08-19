// Shared design-system primitives.
//
// These wrap the .sy-* classes in app/globals.css. Pages compose these
// rather than re-declaring a card, chip or price in a page-local <style>
// block — that re-declaration is how the previous system ended up with
// fifteen independent copies of one brand colour.
//
// Rules live in DESIGN.md. The ones that bite most often:
//   - grids use minmax(0, 1fr), never bare 1fr (long content sets min-content)
//   - every figure is tabular
//   - only covers cast shadows

import Link from 'next/link'
import type { ReactNode, CSSProperties } from 'react'

/* ---------- Condition ---------- */

export const CONDITION: Record<string, { label: string; color: string }> = {
  like_new: { label: 'Like New', color: 'var(--color-cond-like-new)' },
  very_good: { label: 'Very Good', color: 'var(--color-cond-very-good)' },
  good: { label: 'Good', color: 'var(--color-cond-good)' },
  acceptable: { label: 'Acceptable', color: 'var(--color-cond-acceptable)' },
}

export function ConditionMarker({ condition }: { condition: string }) {
  const c = CONDITION[condition] ?? CONDITION.good
  return (
    <span className="sy-cond">
      <i style={{ background: c.color }} aria-hidden />
      {c.label}
    </span>
  )
}

/* ---------- Numbers ---------- */

/** Counts render with thousands separators. A bare "3622" reads as an id,
 *  not a quantity. Locale is en-GB per PRODUCT.md. Number formatting with an
 *  explicit locale is deterministic, so this is hydration-safe. */
export function formatCount(n: number): string {
  return Number(n).toLocaleString('en-GB')
}

/**
 * Dates are formatted in UTC, always.
 *
 * Without an explicit timeZone the server (UTC) and the browser (whatever
 * the reader is in) can disagree — a timestamp at 23:30 on the 31st renders
 * as a different month on each side, which React reports as a hydration
 * mismatch. Pinning the zone makes the output identical everywhere.
 */
export function formatDate(
  value: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' })
}

/* ---------- Money ---------- */

export function Price({ value, large = false, className = '' }: { value: number; large?: boolean; className?: string }) {
  return (
    <span className={`sy-price${large ? ' sy-price-lg' : ''} ${className}`.trim()}>
      £{Number(value).toFixed(2)}
    </span>
  )
}

/* ---------- Actions ---------- */

type ButtonProps = {
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'light' | 'quiet'
  children: ReactNode
  style?: CSSProperties
  type?: 'button' | 'submit'
  fullWidth?: boolean
  ariaLabel?: string
}

export function Button({
  href, onClick, variant = 'primary', children, style, type = 'button', fullWidth, ariaLabel,
}: ButtonProps) {
  const cls = `sy-cta sy-cta-${variant === 'primary' ? 'solid' : variant}`
  const css: CSSProperties = { ...(fullWidth ? { width: '100%' } : null), ...style }
  if (href) {
    return <Link href={href} className={cls} style={css} aria-label={ariaLabel}>{children}</Link>
  }
  return (
    <button type={type} onClick={onClick} className={cls} style={css} aria-label={ariaLabel}>
      {children}
    </button>
  )
}

export function Chip({ href, children, active = false }: { href: string; children: ReactNode; active?: boolean }) {
  return (
    <Link href={href} className={`sy-chip${active ? ' is-active' : ''}`}>
      {children}
    </Link>
  )
}

/* ---------- Type ---------- */

export function SectionMark({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span className="sy-mark" style={style}>{children}</span>
}

export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="sy-panel" style={style}>{children}</div>
}

/* ---------- Book card ---------- */

export type BookCardData = {
  id?: number | string
  title: string
  author?: string | null
  price: number
  condition?: string
  cover?: string | null
  /** This listing is also available inside a seller bundle. Surfacing it
   *  on the cover is a basket-building cue: the same book costs less as
   *  part of a set, and bundles ship as one parcel. */
  inBundle?: boolean
}

export function BookCover({ book }: { book: BookCardData }) {
  return (
    <span className="sy-cover">
      {book.cover ? <img src={book.cover} alt="" /> : <em>{book.title}</em>}
      {book.inBundle && <span className="sy-cover-badge">In a bundle</span>}
    </span>
  )
}

/**
 * `action` renders below the card as a sibling, not inside the link — a
 * button nested in an anchor is invalid HTML and swallows its own clicks.
 */
export function BookCard({
  book, href, action,
}: { book: BookCardData; href?: string; action?: ReactNode }) {
  const body = (
    <>
      <BookCover book={book} />
      <span className="sy-card-meta">
        <span className="sy-card-title">{book.title}</span>
        {book.author ? <span className="sy-card-author">{book.author}</span> : null}
        <span className="sy-card-foot">
          <Price value={book.price} />
          {book.condition ? <ConditionMarker condition={book.condition} /> : null}
        </span>
      </span>
    </>
  )
  const card = href
    ? <Link href={href} className="sy-card">{body}</Link>
    : <div className="sy-card">{body}</div>
  if (!action) return card
  return (
    <div className="sy-card-wrap">
      {card}
      <div className="sy-card-action">{action}</div>
    </div>
  )
}

export function BookGrid({ children }: { children: ReactNode }) {
  return <div className="sy-grid">{children}</div>
}

/* ---------- Page shell ---------- */

export function PageShell({ children }: { children: ReactNode }) {
  return <main className="sy-page">{children}</main>
}

export function Wrap({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="sy-wrap" style={style}>{children}</div>
}
