import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  const { direction } = await req.json() as { direction: 'web-to-app' | 'app-to-web' }

  // Get all active tags
  const { data: tags, error: fetchError } = await supabase
    .from('editorial_tags')
    .select('id, display_order, app_display_order')
    .eq('active', true)

  if (fetchError || !tags) {
    return NextResponse.json({ error: fetchError?.message || 'Failed to fetch tags' }, { status: 500 })
  }

  // Update each tag: set show_on = 'both' and copy ordering
  for (const tag of tags) {
    const updates: Record<string, unknown> = { show_on: 'both' }

    if (direction === 'web-to-app') {
      updates.app_display_order = tag.display_order
    } else {
      updates.display_order = tag.app_display_order
    }

    await supabase
      .from('editorial_tags')
      .update(updates)
      .eq('id', tag.id)
  }

  return NextResponse.json({ success: true, synced: tags.length })
}
