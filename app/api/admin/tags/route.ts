import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[£$€]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function GET() {
  const { data, error } = await supabase
    .from('editorial_tags')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const { id, active, display_order, app_display_order, label, slug, description, show_on } = await req.json()

  const updates: Record<string, unknown> = {}
  if (typeof active === 'boolean') updates.active = active
  if (typeof display_order === 'number') updates.display_order = display_order
  if (typeof app_display_order === 'number') updates.app_display_order = app_display_order
  if (typeof label === 'string') {
    updates.label = label
    updates.slug = slug || slugify(label)
  }
  if (typeof description === 'string') updates.description = description
  if (typeof show_on === 'string' && ['web', 'app', 'both'].includes(show_on)) updates.show_on = show_on

  const { error } = await supabase
    .from('editorial_tags')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest) {
  const { label, description } = await req.json()

  if (!label?.trim()) {
    return NextResponse.json({ error: 'Label is required' }, { status: 400 })
  }

  const slug = slugify(label.trim())

  // Get max display_order to put new tag at end
  const { data: existing } = await supabase
    .from('editorial_tags')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.display_order ?? 0) + 1

  const { data, error } = await supabase
    .from('editorial_tags')
    .insert({
      label: label.trim(),
      slug,
      description: description?.trim() || '',
      display_order: nextOrder,
      app_display_order: nextOrder,
      show_on: 'both',
      active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
