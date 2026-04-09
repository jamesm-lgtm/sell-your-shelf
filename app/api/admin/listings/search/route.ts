import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json([])

  // Search listings, then fetch their tags separately to avoid failure if tables don't exist yet
  const { data, error } = await supabase
    .from('listings')
    .select(`
      id, title, author, asking_price_gbp, condition,
      books(cover_url, cover_url_hosted, isbn)
    `)
    .eq('status', 'active')
    .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch editorial tags for these listings
  const listingIds = (data ?? []).map((l: any) => l.id)
  let tagMap: Record<number, { tag_id: number }[]> = {}

  if (listingIds.length > 0) {
    const { data: tagData } = await supabase
      .from('listing_editorial_tags')
      .select('listing_id, tag_id')
      .in('listing_id', listingIds)

    if (tagData) {
      for (const row of tagData) {
        if (!tagMap[row.listing_id]) tagMap[row.listing_id] = []
        tagMap[row.listing_id].push({ tag_id: row.tag_id })
      }
    }
  }

  const results = (data ?? []).map((l: any) => ({
    ...l,
    listing_editorial_tags: tagMap[l.id] ?? [],
  }))

  return NextResponse.json(results)
}
