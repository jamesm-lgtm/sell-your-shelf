/**
 * Shared share-card renderer for the file-based `opengraph-image` routes
 * on /listing/[id], /books/[slug] and /bundle/[id].
 *
 * Why this exists: book covers are portrait (~333×500). Handing one
 * straight to WhatsApp/iMessage/Twitter as the og:image gets it either
 * centre-cropped to a letterbox strip or demoted to a small square
 * thumbnail, because those clients want a ~1.91:1 card. Composing the
 * cover onto a 1200×630 branded canvas gives every share the same
 * full-bleed treatment — and lets the card carry the price and author,
 * which a bare cover can't.
 *
 * Satori (the renderer behind ImageResponse) supports a subset of CSS:
 * flexbox only, every element with 2+ children needs an explicit
 * `display: flex`, and no grid. Keep layout changes inside those rules.
 */

import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

const FOREST_DEEP = '#1F3329'
const GOLD = '#C9A961'

/** Cap a string at n chars on a word boundary, with an ellipsis. */
function clamp(text: string, n: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  return t.slice(0, t.lastIndexOf(' ', n) > n * 0.6 ? t.lastIndexOf(' ', n) : n).trim() + '…'
}

/**
 * Fetch a cover and inline it as a data URI.
 *
 * Satori fetches remote <img> URLs itself, but a 404 or a slow origin
 * makes the whole ImageResponse throw — which would mean NO preview at
 * all, a worse outcome than a card with no cover. Fetching here lets a
 * failure degrade to a text-only card instead.
 */
export async function loadCover(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? ''
    if (!type.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    // Satori inlines this as-is; anything much over ~1MB slows rendering
    // more than the cover is worth.
    if (buf.byteLength > 1_500_000) return null
    return `data:${type};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/** Title-size ramp — long titles step down so they never wrap past 3 lines. */
function titleSize(title: string): number {
  if (title.length <= 28) return 64
  if (title.length <= 52) return 52
  return 44
}

type CardArgs = {
  /** Data URIs from loadCover(), already filtered for nulls. 1–3 shown. */
  covers: string[]
  /** Small gold line above the title, e.g. "Bundle from @oliversmith". */
  eyebrow?: string | null
  title: string
  /** Author, or the bundle's member count line. */
  subtitle?: string | null
  /** The commercial hook — "£3.00 · Very Good", "6 books · save £4.20". */
  highlight?: string | null
}

/**
 * Generic card for when the entity can't be resolved — a deleted
 * listing, a bad id, a slug that matches nothing. Better than a 500,
 * which leaves the share with no preview at all.
 */
export function renderFallbackCard() {
  return renderOgCard({
    covers: [],
    eyebrow: 'Secondhand books',
    title: 'Buy and sell used books',
  })
}

export function renderOgCard({ covers, eyebrow, title, subtitle, highlight }: CardArgs) {
  const shown = covers.slice(0, 3)

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          padding: '56px 64px',
          // Flat, not a gradient: resvg dithers gradients, which pushed
          // the PNG ~40% heavier (449KB → 355KB on a 3-cover bundle).
          // WhatsApp skips preview images over ~600KB, so the headroom
          // matters more than the sheen.
          backgroundColor: FOREST_DEEP,
          borderLeft: `14px solid ${GOLD}`,
        }}
      >
        {/* Covers — overlapped left-to-right for bundles, single for books */}
        {shown.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', marginRight: 56 }}>
            {shown.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- satori renders raw <img>; next/image doesn't apply here
              <img
                key={i}
                src={src}
                alt=""
                width={shown.length > 1 ? 230 : 320}
                height={shown.length > 1 ? 345 : 480}
                style={{
                  objectFit: 'cover',
                  borderRadius: 10,
                  border: '3px solid rgba(255,255,255,0.14)',
                  // Overlap so a bundle reads as several books, but leave
                  // enough of each spine visible to be recognisable at
                  // thumbnail size.
                  marginLeft: i === 0 ? 0 : -78,
                  boxShadow: '0 18px 40px rgba(0,0,0,0.45)',
                }}
              />
            ))}
          </div>
        )}

        {/* Text column */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
          {eyebrow && (
            <div
              style={{
                fontSize: 24,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: GOLD,
                marginBottom: 18,
              }}
            >
              {clamp(eyebrow, 42)}
            </div>
          )}

          <div
            style={{
              fontSize: titleSize(title),
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1.12,
            }}
          >
            {clamp(title, 78)}
          </div>

          {subtitle && (
            <div style={{ fontSize: 32, color: 'rgba(255,255,255,0.72)', marginTop: 16 }}>
              {clamp(subtitle, 60)}
            </div>
          )}

          {highlight && (
            <div style={{ fontSize: 38, fontWeight: 700, color: GOLD, marginTop: 28 }}>
              {clamp(highlight, 46)}
            </div>
          )}

          {/* Wordmark pinned to the bottom of the text column */}
          <div
            style={{
              display: 'flex',
              marginTop: 'auto',
              fontSize: 24,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.62)',
            }}
          >
            Sell Your Shelf
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  )
}
