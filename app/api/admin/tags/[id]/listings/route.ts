import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

type Props = {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Props) {
  const { id } = await params
  const tagId = parseInt(id)
  if (isNaN(tagId)) return NextResponse.json({ error: 'Invalid tag ID' }, { status: 400 })

  const { data: tagEntries } = await supabase
    .from('listing_editorial_tags')
    .select('listing_id')
    .eq('tag_id', tagId)

  if (!tagEntries || tagEntries.length === 0) return NextResponse.json([])

  const listingIds = tagEntries.map(e => e.listing_id)

  const { data: listings, error } = await supabase
    .from('listings')
    .select(`
      id, title, author, asking_price_gbp, condition,
      books(cover_url, cover_url_hosted)
    `)
    .eq('status', 'active')
    .in('id', listingIds)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(listings ?? [])
}
