import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export type CuratedListing = {
  id: number
  asking_price_gbp: number
  condition: string
  books: { title: string; author: string | null; cover_url: string | null } | null
}

export type TagRow = {
  label: string
  slug: string
  description: string
  listings: CuratedListing[]
}

export async function getCuratedRows(): Promise<TagRow[]> {
  // Get all active tags — try with description, fall back without if column doesn't exist yet
  let { data: tags, error } = await supabase
    .from('editorial_tags')
    .select('id, label, slug, display_order, description')
    .eq('active', true)
    .order('display_order', { ascending: true })

  if (error || !tags) {
    const fallback = await supabase
      .from('editorial_tags')
      .select('id, label, slug, display_order')
      .eq('active', true)
      .order('display_order', { ascending: true })
    tags = (fallback.data ?? []).map((t: any) => ({ ...t, description: '' }))
  }

  if (!tags || tags.length === 0) return []

  // Get all tagged listings for active tags
  const { data: taggedListings } = await supabase
    .from('listing_editorial_tags')
    .select(`
      tag_id,
      listings!inner(
        id, asking_price_gbp, condition, status,
        books(title, author, cover_url)
      )
    `)
    .in('tag_id', tags.map(t => t.id))

  if (!taggedListings) return []

  // Group by tag, filter to active listings only
  const rowMap = new Map<number, CuratedListing[]>()

  for (const entry of taggedListings as any[]) {
    const listing = entry.listings
    if (!listing || listing.status !== 'active') continue

    const tagId = entry.tag_id
    if (!rowMap.has(tagId)) rowMap.set(tagId, [])
    rowMap.get(tagId)!.push({
      id: listing.id,
      asking_price_gbp: listing.asking_price_gbp,
      condition: listing.condition,
      books: listing.books,
    })
  }

  // Build rows — only include tags with at least 3 listings
  return tags
    .map(tag => ({
      label: tag.label,
      slug: tag.slug,
      description: tag.description || '',
      listings: rowMap.get(tag.id) ?? [],
    }))
    .filter(row => row.listings.length >= 3)
}
