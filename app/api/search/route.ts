import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || ''

  if (q.length < 2) {
    return NextResponse.json([])
  }

  const { data, error } = await supabase.rpc('search_books_fuzzy', {
    search_term: q,
    result_limit: 8,
  })

  if (error) {
    console.error('Search RPC error:', error)
    return NextResponse.json([], { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
