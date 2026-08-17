/**
 * Share card for /listing/[id] — one seller's copy. This is what the
 * app's book detail screen shares, so it's the highest-volume card.
 *
 * Price and condition are the hook; both go in the gold highlight line.
 */

import { createClient } from '@supabase/supabase-js'
import { OG_CONTENT_TYPE, OG_SIZE, loadCover, renderFallbackCard, renderOgCard } from '@/app/lib/ogCard'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Used book on Sell Your Shelf'
export const revalidate = 3600

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const CONDITIONS: Record<string, string> = {
  like_new: 'Like New',
  very_good: 'Very Good',
  good: 'Good',
  acceptable: 'Acceptable',
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data } = await supabase
    .from('marketplace_listings')
    .select('title, author, asking_price_gbp, condition, edition_cover, work_cover, edition_cover_hosted, work_cover_hosted')
    .eq('id', id)
    .single()

  // Sold copies 301 to the book hub, so a crawler that lands here on a
  // missing row is following a stale link — give it the generic card.
  if (!data) return renderFallbackCard()

  const cover = await loadCover(
    data.edition_cover_hosted || data.edition_cover || data.work_cover_hosted || data.work_cover
  )
  const condition = CONDITIONS[data.condition as string] ?? null
  const price = `£${Number(data.asking_price_gbp).toFixed(2)}`

  return renderOgCard({
    covers: cover ? [cover] : [],
    eyebrow: 'Used copy',
    title: data.title,
    subtitle: data.author ? `by ${data.author}` : null,
    highlight: condition ? `${price} · ${condition}` : price,
  })
}
