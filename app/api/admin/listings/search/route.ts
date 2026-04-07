import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json([])

  const { data, error } = await supabase
    .from('listings')
    .select(`
      id, title, author, asking_price_gbp, condition,
      books(cover_url, isbn13),
      listing_editorial_tags(tag_id)
    `)
    .eq('status', 'active')
    .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
