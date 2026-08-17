/**
 * Slug → book lookup, shared by /books/[slug]'s page and its
 * opengraph-image route so a share card can never resolve to a
 * different book than the page it came from.
 *
 * Lifted verbatim out of app/books/[slug]/page.tsx — behaviour
 * unchanged, including the pre-migration fuzzy fallback.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export function generateSlug(title: string, author: string): string {
  return `${title}-${author}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function findBookBySlug(slug: string) {
  const bookFields = 'id, title, author, title_normalized, author_normalized, cover_url, cover_url_hosted, description, isbn, category'

  // Primary: direct slug column lookup (requires migration)
  const { data: directMatch } = await supabase
    .from('books')
    .select(bookFields)
    .eq('slug', slug)
    .limit(1)
    .single()

  if (directMatch) return directMatch

  // Fallback: fuzzy search for pre-migration compatibility
  const words = slug.split('-').filter(w => w.length > 2)
  if (words.length === 0) return null

  const fuzzyWord = (w: string) => w.replace(/s$/, '')
  const firstWord = fuzzyWord(words[0])
  const lastWord = fuzzyWord(words[words.length - 1])

  type SlugCandidate = {
    title?: string | null
    title_normalized?: string | null
    author?: string | null
    author_normalized?: string | null
  }

  const matchSlug = (b: SlugCandidate) => {
    const bookSlug = generateSlug(
      b.title_normalized || b.title || '',
      b.author_normalized || b.author || ''
    )
    return bookSlug === slug
  }

  const { data: candidates } = await supabase
    .from('books')
    .select(bookFields)
    .ilike('title_normalized', `%${firstWord}%`)
    .ilike('author_normalized', `%${lastWord}%`)
    .limit(100)

  const match1 = candidates?.find(matchSlug)
  if (match1) return match1

  const { data: fallback } = await supabase
    .from('books')
    .select(bookFields)
    .ilike('title_normalized', `%${firstWord}%`)
    .limit(200)

  return fallback?.find(matchSlug) ?? null
}
