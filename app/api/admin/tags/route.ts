import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET() {
  const { data, error } = await supabase
    .from('editorial_tags')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const { id, active, display_order } = await req.json()

  const updates: Record<string, unknown> = {}
  if (typeof active === 'boolean') updates.active = active
  if (typeof display_order === 'number') updates.display_order = display_order

  const { error } = await supabase
    .from('editorial_tags')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
