/**
 * Share card for /books/[slug] — the hub page shared from the app's
 * "Available copies" screen and from search results.
 *
 * Leads with availability ("3 copies from £3.24"), since that's the
 * reason to tap through on a title someone already recognises.
 */

import { createClient } from '@supabase/supabase-js'
import { findBookBySlug } from '@/app/lib/bookLookup'
import { OG_CONTENT_TYPE, OG_SIZE, loadCover, renderFallbackCard, renderOgCard } from '@/app/lib/ogCard'

export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Used copies on Sell Your Shelf'
// Covers and prices move slowly, and share clients cache previews hard —
// an hour of reuse keeps this off the per-request path.
export const revalidate = 3600

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const book = await findBookBySlug(slug)

  if (!book) return renderFallbackCard()

  const { data: listings } = await supabase
    .from('listings')
    .select('asking_price_gbp')
    .eq('book_id', book.id)
    .eq('status', 'active')

  const count = listings?.length ?? 0
  const lowest = count > 0
    ? Math.min(...listings!.map(l => Number(l.asking_price_gbp))).toFixed(2)
    : null

  const cover = await loadCover(book.cover_url_hosted || book.cover_url)

  return renderOgCard({
    covers: cover ? [cover] : [],
    eyebrow: 'Used copies',
    title: book.title,
    subtitle: book.author ? `by ${book.author}` : null,
    highlight: lowest
      ? `${count} cop${count === 1 ? 'y' : 'ies'} from £${lowest}`
      : 'Out of stock — sell yours',
  })
}
