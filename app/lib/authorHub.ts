/**
 * Data for the author and publisher hub pages.
 *
 * Shared because /author/[slug] and /publisher/[slug] are the same page with a
 * different noun — CGP Books has 103 live copies and is the only cluster
 * already ranking (position 7.5), because revision-guide buyers search by
 * publisher. It earns the same template, not a block.
 */
import { createClient } from '@supabase/supabase-js'
import { generateSlug } from '@/app/lib/bookLookup'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

/**
 * A page is indexed at five live copies or more.
 *
 * Five is where the page can do the job it exists for. The commercial case is
 * basket-building — delivery is free over £10 and the average book is £4.50,
 * so a useful page has to be able to offer three books somebody wants. Below
 * five it usually can't, and an indexed page that can't is the thin-content
 * problem rather than a fix for it.
 */
export const INDEX_THRESHOLD = 5

export type HubCopy = {
  listingId: number
  priceGbp: number
  condition: string
  sellerUsername: string | null
}

export type HubTitle = {
  bookId: number
  title: string
  slug: string | null
  coverUrl: string | null
  copies: HubCopy[]
}

export type AuthorHub = {
  slug: string
  displayName: string
  kind: 'person' | 'publisher' | 'unknown'
  titles: HubTitle[]
  liveCopies: number
  /** Cheapest live copy, for the meta description and the offer schema. */
  lowestPriceGbp: number | null
  sellers: number
}

/**
 * The URL for a book page.
 *
 * Only 7% of books with a live listing have a persisted `slug` — 381 of 5,199
 * — so reading the column alone would leave most titles here as dead text.
 * The sitemap already solves this with `book.slug || generateSlug(...)`, and
 * findBookBySlug resolves both forms. Using anything else would mint a second
 * URL for the same book and put this page in conflict with the canonical the
 * listing pages point at, which is the failure the last release unpicked.
 */
function bookSlug(b: { slug: string | null; title_normalized: string | null; title: string; author_normalized: string | null }): string | null {
  return b.slug || generateSlug(b.title_normalized || b.title || '', b.author_normalized || '') || null
}

/**
 * Key for grouping duplicate catalogue rows onto one entry.
 *
 * Deliberately conservative. It strips one thing: the ": A book by <author>"
 * suffix some rows carry, which is publisher boilerplate rather than part of
 * the title — and which reads absurdly on an author page, where every book is
 * by that author. "Code Name Bananas" and "Code Name Bananas: A book by David
 * Walliams" are the same book and were showing as two entries at different
 * prices.
 *
 * It does NOT strip trailing parentheticals. "Gangsta Granny (original)" still
 * groups apart from "Gangsta Granny", because a bracketed qualifier can be a
 * real distinction — a graphic novel, an abridgement — and merging those would
 * put genuinely different books on one row at a price that belongs to neither.
 * That leaves a small number of visible duplicates, which is the honest
 * outcome for rows the catalogue itself doesn't distinguish cleanly.
 */
/**
 * Display title with the publisher boilerplate removed.
 *
 * groupingKey() already strips ": A book by <author>" to merge duplicate rows,
 * but it lowercases, so it can't be used for display. Without this the card on
 * David Walliams' own page reads "Demon Dentist: A book by David Walliams",
 * which is both redundant and faintly absurd in context.
 */
export function displayTitle(title: string): string {
  return title.replace(/:\s*a book by\b.*$/i, '').replace(/\s+/g, ' ').trim() || title
}

function groupingKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/:\s*a book by\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function getAuthorHub(
  slug: string,
  kind: 'person' | 'publisher',
): Promise<AuthorHub | null> {
  const { data: author, error } = await supabase
    .from('authors')
    .select('id, slug, display_name, kind, needs_review')
    .eq('slug', slug)
    .maybeSingle()

  // A missing table (before the migration is applied) and a genuine query
  // failure both land here and both 404, which is the right behaviour for the
  // reader either way. Log it so the second case doesn't masquerade as the
  // first — a page meant to rank shouldn't disappear silently.
  if (error) console.error('[authorHub] lookup failed for', slug, error.message)

  // needs_review means a model returned tokens that weren't in the source
  // string — a possible invented name. Those don't render until a person has
  // looked, because a wrong name is worse than a missing page.
  if (!author || author.needs_review) return null
  if (author.kind !== kind) return null

  const { data: links } = await supabase
    .from('book_authors')
    .select('book_id')
    .eq('author_id', author.id)

  const bookIds = (links ?? []).map((l) => l.book_id)
  if (!bookIds.length) {
    return { slug: author.slug, displayName: author.display_name, kind: author.kind, titles: [], liveCopies: 0, lowestPriceGbp: null, sellers: 0 }
  }

  // Books an author has written can exceed 1,000 for a prolific one, and
  // listings certainly can, so both reads page explicitly. The sitemap learnt
  // this the hard way when active listings passed 1,000.
  const books: { id: number; title: string; title_normalized: string | null; author_normalized: string | null; slug: string | null; cover_url_hosted: string | null; cover_url: string | null }[] = []
  for (let i = 0; i < bookIds.length; i += 500) {
    const { data } = await supabase
      .from('books')
      .select('id, title, title_normalized, author_normalized, slug, cover_url_hosted, cover_url')
      .in('id', bookIds.slice(i, i + 500))
    if (data) books.push(...data)
  }

  const listings: { id: number; book_id: number; asking_price_gbp: number; condition: string; user_id: string }[] = []
  for (let i = 0; i < bookIds.length; i += 500) {
    const { data } = await supabase
      .from('listings')
      .select('id, book_id, asking_price_gbp, condition, user_id')
      .in('book_id', bookIds.slice(i, i + 500))
      .eq('status', 'active')
    if (data) listings.push(...data)
  }

  const sellerIds = [...new Set(listings.map((l) => l.user_id))]
  const usernameById = new Map<string, string | null>()
  for (let i = 0; i < sellerIds.length; i += 500) {
    const { data } = await supabase.from('users').select('id, username').in('id', sellerIds.slice(i, i + 500))
    for (const u of data ?? []) usernameById.set(u.id, u.username)
  }

  const byBook = new Map<number, HubCopy[]>()
  for (const l of listings) {
    const copies = byBook.get(l.book_id) ?? []
    copies.push({
      listingId: l.id,
      priceGbp: Number(l.asking_price_gbp),
      condition: l.condition,
      sellerUsername: usernameById.get(l.user_id) ?? null,
    })
    byBook.set(l.book_id, copies)
  }

  /**
   * Group by title, not by book row.
   *
   * The catalogue holds more than one `books` row for the same title — David
   * Walliams' "Code Name Bananas" exists twice, and grouping on book_id showed
   * it as two separate entries with different prices, which reads as a broken
   * page. Duplicate rows also don't reliably share a slug, so the merge keeps
   * the first one that has both a slug and a cover.
   */
  const byTitle = new Map<string, HubTitle>()
  for (const b of books) {
    if (!byBook.has(b.id)) continue
    const key = groupingKey(b.title_normalized ?? b.title ?? '')
    if (!key) continue
    const existing = byTitle.get(key)
    if (!existing) {
      byTitle.set(key, {
        bookId: b.id,
        title: displayTitle(b.title),
        slug: bookSlug(b),
        coverUrl: b.cover_url_hosted ?? b.cover_url,
        copies: [...(byBook.get(b.id) ?? [])],
      })
      continue
    }
    existing.copies.push(...(byBook.get(b.id) ?? []))
    existing.slug ??= bookSlug(b)
    existing.coverUrl ??= b.cover_url_hosted ?? b.cover_url
    // Duplicate rows differ by trailing publisher boilerplate, so the shorter
    // title is the cleaner one.
    const candidate = displayTitle(b.title)
    if (candidate.length < existing.title.length) existing.title = candidate
  }

  const titles: HubTitle[] = [...byTitle.values()]
    .map((t) => ({ ...t, copies: t.copies.sort((x, y) => x.priceGbp - y.priceGbp) }))
    // Most copies first: the titles somebody is most likely to want are the
    // ones several sellers happen to hold.
    .sort((a, b) => b.copies.length - a.copies.length || a.title.localeCompare(b.title))

  const prices = listings.map((l) => Number(l.asking_price_gbp)).filter((n) => Number.isFinite(n))

  return {
    slug: author.slug,
    displayName: author.display_name,
    kind: author.kind,
    titles,
    liveCopies: listings.length,
    lowestPriceGbp: prices.length ? Math.min(...prices) : null,
    sellers: sellerIds.length,
  }
}

/**
 * The author hub to link to from a book or listing page, if there is one.
 *
 * Returns null unless the hub clears the index threshold. That gate is the
 * whole point: linking to a page carrying `noindex` spends crawl budget on
 * something we've told Google to ignore, and sends a reader somewhere with
 * two books on it. Links therefore appear and disappear as inventory moves,
 * which is correct — the link is only worth following while the page is.
 *
 * Without this the hubs are orphans, reachable only from the sitemap. Internal
 * links are how they get discovered and how a reader ever finds them.
 */
export async function getAuthorLinkForBook(
  bookId: number,
): Promise<{ slug: string; kind: string; displayName: string } | null> {
  const { data: links } = await supabase
    .from('book_authors')
    .select('author_id, position')
    .eq('book_id', bookId)
    .order('position', { ascending: true })

  const authorIds = (links ?? []).map((l) => l.author_id)
  if (!authorIds.length) return null

  // The primary credit first — an illustrator shouldn't outrank the author
  // just because their page happens to be bigger.
  const { data } = await supabase
    .from('author_live_counts')
    .select('author_id, slug, display_name, kind, live_copies')
    .in('author_id', authorIds)
    .gte('live_copies', INDEX_THRESHOLD)

  if (!data?.length) return null
  const best = authorIds.map((id) => data.find((d) => d.author_id === id)).find(Boolean)
  if (!best) return null
  return { slug: best.slug, kind: best.kind, displayName: best.display_name }
}

/** Slugs worth putting in the sitemap — indexed pages only. */
export async function getIndexableHubSlugs(kind: 'person' | 'publisher'): Promise<string[]> {
  const { data } = await supabase
    .from('author_live_counts')
    .select('slug, live_copies, kind')
    .eq('kind', kind)
    .gte('live_copies', INDEX_THRESHOLD)
  return (data ?? []).map((r) => r.slug)
}
