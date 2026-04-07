import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function PUT(req: NextRequest) {
  const { listing_id, tag_ids } = await req.json() as { listing_id: number; tag_ids: number[] }

  // Remove all existing tags for this listing
  const { error: deleteError } = await supabase
    .from('listing_editorial_tags')
    .delete()
    .eq('listing_id', listing_id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  // Insert new tags
  if (tag_ids.length > 0) {
    const rows = tag_ids.map(tag_id => ({ listing_id, tag_id }))
    const { error: insertError } = await supabase
      .from('listing_editorial_tags')
      .insert(rows)

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
