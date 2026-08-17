/**
 * Share card for /bundle/[id].
 *
 * Shows up to three member covers fanned out, so the card reads as
 * "several books" at thumbnail size, and leads with the saving — the
 * whole reason a bundle beats buying the copies separately.
 *
 * Price is recomputed from the members via the shared pricing utility
 * rather than read off bundles.price_gbp, matching what the page and
 * the app show if a member's asking price has since changed.
 */

import { createClient } from '@supabase/supabase-js'
import { computeBundlePricing } from '@/app/lib/bundlePricing'
import { OG_CONTENT_TYPE, OG_SIZE, loadCover, renderFallbackCard, renderOgCard } from '@/app/lib/ogCard'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Book bundle on Sell Your Shelf'
export const revalidate = 3600

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

type Member = {
  id: number
  asking_price_gbp: number
  status: string
  books: { cover_url: string | null; cover_url_hosted: string | null } | null
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v)

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bundleId = Number(id)

  // Draft and archived bundles have no public page — same generic card.
  if (!Number.isInteger(bundleId) || bundleId <= 0) return renderFallbackCard()

  const { data } = await supabase
    .from('bundles')
    .select(`
      id, name, status, pricing_mode, discount_pct, price_gbp,
      seller:users!inner ( username ),
      bundle_items (
        sort_order,
        listing:listings!inner (
          id, asking_price_gbp, status,
          books ( cover_url, cover_url_hosted )
        )
      )
    `)
    .eq('id', bundleId)
    .single()

  if (!data || data.status !== 'active') return renderFallbackCard()

  const seller = one(data.seller as { username: string } | { username: string }[] | null)
  const items = (data.bundle_items ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map(it => one(it.listing as unknown as Member | Member[] | null))
    .filter((l): l is Member => !!l)

  const pricing = computeBundlePricing({
    listings: items.map(l => ({ listingId: l.id, askingPriceGbp: Number(l.asking_price_gbp) })),
    pricingMode: data.pricing_mode,
    discountPct: data.discount_pct ?? undefined,
    priceGbp: data.price_gbp != null ? Number(data.price_gbp) : undefined,
  })

  // Load covers in parallel and keep the first three that resolve, so a
  // single dead cover URL doesn't leave a gap in the stack.
  const covers = (
    await Promise.all(
      items.slice(0, 6).map(l => loadCover(l.books?.cover_url_hosted || l.books?.cover_url)),
    )
  )
    .filter((c): c is string => !!c)
    .slice(0, 3)

  const count = items.length
  const saving = pricing.totalDiscountGbp
  const highlight =
    saving > 0
      ? `£${pricing.bundlePriceGbp.toFixed(2)} · save £${saving.toFixed(2)}`
      : `£${pricing.bundlePriceGbp.toFixed(2)} for ${count} books`

  return renderOgCard({
    covers,
    eyebrow: seller?.username ? `Bundle from @${seller.username}` : 'Book bundle',
    title: data.name,
    subtitle: `${count} ${count === 1 ? 'book' : 'books'} · one parcel`,
    highlight,
  })
}
