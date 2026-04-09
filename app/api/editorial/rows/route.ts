import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export const revalidate = 0

export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get('platform') || 'web'
  const tagSlug = req.nextUrl.searchParams.get('tag') // optional: filter to single tag

  // Determine show_on filter and ordering based on platform
  const showOnValues = platform === 'app'
    ? ['app', 'both']
    : ['web', 'both']
  const orderField = platform === 'app' ? 'app_display_order' : 'display_order'

  // Fetch active tags for this platform
  let tagsQuery = supabase
    .from('editorial_tags')
    .select('id, label, slug, description, display_order, app_display_order, show_on')
    .eq('active', true)
    .in('show_on', showOnValues)

  if (tagSlug) {
    tagsQuery = tagsQuery.eq('slug', tagSlug)
  }

  let { data: tags, error: tagsError } = await tagsQuery

  // Fallback if show_on column doesn't exist yet
  if (tagsError) {
    const fallback = await supabase
      .from('editorial_tags')
      .select('id, label, slug, description, display_order')
      .eq('active', true)

    tags = (fallback.data ?? []).map((t: any) => ({
      ...t,
      app_display_order: t.display_order,
      show_on: 'both',
    }))
  }

  if (!tags || tags.length === 0) return NextResponse.json([])

  // Sort by the appropriate order field
  tags.sort((a: any, b: any) => {
    const aOrder = platform === 'app' ? (a.app_display_order ?? a.display_order) : a.display_order
    const bOrder = platform === 'app' ? (b.app_display_order ?? b.display_order) : b.display_order
    return aOrder - bOrder
  })

  // Fetch all tagged listings for these tags
  const tagIds = tags.map((t: any) => t.id)

  const { data: tagEntries } = await supabase
    .from('listing_editorial_tags')
    .select('listing_id, tag_id')
    .in('tag_id', tagIds)

  if (!tagEntries || tagEntries.length === 0) return NextResponse.json([])

  // Get unique listing IDs
  const listingIds = [...new Set(tagEntries.map(e => e.listing_id))]

  // Fetch listing details — shaped to match the app's BrowseListing type
  const { data: listings } = await supabase
    .from('listings')
    .select(`
      id, title, author, asking_price_gbp, condition, status,
      book_id,
      books(isbn, title, author, cover_url, cover_url_hosted, category),
      users!inner(username, deleted_at, is_verified)
    `)
    .eq('status', 'active')
    .is('users.deleted_at', null)
    .in('id', listingIds)
    .limit(500)

  if (!listings) return NextResponse.json([])

  // Build a lookup map: listing_id -> listing data
  const listingMap = new Map<number, any>()
  for (const l of listings as any[]) {
    listingMap.set(l.id, l)
  }

  // Group by tag
  const tagListingMap = new Map<number, any[]>()
  for (const entry of tagEntries) {
    const listing = listingMap.get(entry.listing_id)
    if (!listing) continue

    if (!tagListingMap.has(entry.tag_id)) tagListingMap.set(entry.tag_id, [])
    tagListingMap.get(entry.tag_id)!.push(listing)
  }

  // Build response — shape listings to match app's BrowseListing interface
  const rows = tags
    .map((tag: any) => {
      const tagListings = tagListingMap.get(tag.id) ?? []

      return {
        tag_id: tag.id,
        label: tag.label,
        slug: tag.slug,
        description: tag.description || '',
        listings: tagListings.slice(0, 10).map((l: any) => ({
          group_key: `editorial-${l.id}`,
          isbn_13: l.books?.isbn || null,
          title: l.books?.title || l.title,
          author: l.books?.author || l.author || '',
          category: l.books?.category || null,
          price_from: Number(l.asking_price_gbp),
          price_to: Number(l.asking_price_gbp),
          copy_count: 1,
          display_mode: 'individual' as const,
          listing_id: l.id,
          cover_url: l.books?.cover_url_hosted || l.books?.cover_url || null,
          is_verified: l.users?.is_verified ?? false,
          has_estimated_price: false,
          last_listed: '',
          seller_username: l.users?.username || null,
          seller_id: null,
        })),
      }
    })
    .filter((row: any) => row.listings.length >= 3)

  return NextResponse.json(rows)
}
