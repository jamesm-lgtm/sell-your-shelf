/**
 * Populate `authors` and `book_authors` from the credit strings on `books`.
 *
 * Run:
 *   npx tsx scripts/backfill-authors.ts --dry-run    # report only, writes nothing
 *   npx tsx scripts/backfill-authors.ts              # write
 *
 * Two phases, and this script is phase one.
 *
 *   Phase 1 (here)  Deterministic rules, using the corpus itself as evidence
 *                   for what a comma means. Resolves the large majority.
 *   Phase 2         The residue — credit strings of the shape "Surname, First"
 *                   with no corpus evidence, where "Malpas, Jodi Ellen" (one
 *                   person) and "Gaiman, Pratchett" (two) are indistinguishable
 *                   by rule. Those need world knowledge. They are written to
 *                   ambiguous-credits.json for a model pass; see the note at
 *                   the bottom of this file for why that runs as an edge
 *                   function rather than here.
 *
 * ORDER MATTERS: merge before you count. 32 authors reach five live copies
 * only once their name variants combine — erin russell at 10, terry denton at
 * 7, peter may at 6. Apply the page threshold after this has run, never
 * against the raw strings, or a fifth of the pages silently never exist.
 */
import * as fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { parseCredit, slugify, type Contributor } from '../app/lib/authorName'

const DRY_RUN = process.argv.includes('--dry-run')

// Same manual .env read the other scripts in here use — this repo has no
// dotenv, and Next's loader doesn't apply to a standalone tsx process.
function loadEnv(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {}
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
      }),
  )
}

const env = { ...loadEnv('.env.local'), ...process.env }
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!)

const PAGE = 1000
async function fetchAll<T>(table: string, cols: string): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(cols).range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data?.length) break
    rows.push(...(data as T[]))
    if (data.length < PAGE) break
  }
  return rows
}

type Book = { id: number; author: string | null }
type Listing = { book_id: number | null; author: string | null; status: string }

async function main() {
  console.log(DRY_RUN ? '— dry run, nothing will be written —\n' : '— writing —\n')

  const books = await fetchAll<Book>('books', 'id, author')
  const listings = await fetchAll<Listing>('listings', 'book_id, author, status')
  const active = listings.filter((l) => l.status === 'active' && l.book_id != null)

  // Live copies per book, so the report can show what the pages would hold.
  const copiesPerBook = new Map<number, number>()
  for (const l of active) copiesPerBook.set(l.book_id!, (copiesPerBook.get(l.book_id!) ?? 0) + 1)

  /**
   * Corpus evidence. Every comma-free credit seen anywhere, lowercased. This
   * is what separates "CGP Books, Richard Parsons" (both halves appear alone,
   * so: two contributors) from "Wilson, Jacqueline" (only the flipped form
   * appears alone, so: one person inverted). Built from books AND listings —
   * a name might only ever appear cleanly on one of them.
   */
  const standalone = new Set<string>()
  for (const s of [...books.map((b) => b.author), ...listings.map((l) => l.author)]) {
    const v = (s ?? '').trim()
    if (v && !v.includes(',')) standalone.add(v.toLowerCase().replace(/\s+/g, ' '))
  }

  const authorsBySlug = new Map<string, Contributor>()
  const links: { bookId: number; slug: string; position: number }[] = []
  const ambiguous = new Map<string, number[]>() // raw credit -> book ids
  let junk = 0

  for (const book of books) {
    const result = parseCredit(book.author ?? '', standalone)
    if (result.status === 'junk') { junk++; continue }
    if (result.status === 'ambiguous') {
      const seen = ambiguous.get(result.raw) ?? []
      seen.push(book.id)
      ambiguous.set(result.raw, seen)
      continue
    }
    result.contributors.forEach((c, i) => {
      const slug = slugify(c.name)
      if (!slug) return
      // First spelling wins the display form; ties are broken by the corpus
      // upstream, not here, so this stays deterministic across runs.
      if (!authorsBySlug.has(slug)) authorsBySlug.set(slug, c)
      links.push({ bookId: book.id, slug, position: i })
    })
  }

  // ---- report ----
  const liveBySlug = new Map<string, { titles: number; copies: number }>()
  for (const { bookId, slug } of links) {
    const copies = copiesPerBook.get(bookId) ?? 0
    if (!copies) continue
    const e = liveBySlug.get(slug) ?? { titles: 0, copies: 0 }
    e.titles += 1
    e.copies += copies
    liveBySlug.set(slug, e)
  }
  const over = (n: number) => [...liveBySlug.values()].filter((v) => v.copies >= n)

  console.log(`books                : ${books.length}`)
  console.log(`  resolved by rule   : ${books.length - junk - [...ambiguous.values()].flat().length}`)
  console.log(`  ambiguous (phase 2): ${[...ambiguous.values()].flat().length} books, ${ambiguous.size} distinct strings`)
  console.log(`  junk / no page     : ${junk}`)
  console.log(`\ndistinct contributors with live copies: ${liveBySlug.size}`)
  for (const n of [5, 10, 20]) {
    const o = over(n)
    console.log(`  >=${String(n).padStart(2)} copies: ${String(o.length).padStart(4)} pages, ${o.reduce((a, b) => a + b.copies, 0)} copies`)
  }

  const top = [...liveBySlug.entries()].sort((a, b) => b[1].copies - a[1].copies).slice(0, 12)
  console.log('\ntop 12:')
  for (const [slug, v] of top) {
    const c = authorsBySlug.get(slug)!
    console.log(
      `  ${c.name.padEnd(28)} ${String(v.copies).padStart(4)} copies  ${String(v.titles).padStart(3)} titles  ` +
        `→ /${c.kind === 'publisher' ? 'publisher' : 'author'}/${slug}`,
    )
  }

  if (ambiguous.size) {
    fs.writeFileSync(
      'ambiguous-credits.json',
      JSON.stringify([...ambiguous.entries()].map(([raw, bookIds]) => ({ raw, bookIds })), null, 2),
    )
    console.log(`\nwrote ambiguous-credits.json (${ambiguous.size} strings) for the phase-2 model pass`)
  }

  if (DRY_RUN) { console.log('\n(dry run — nothing written)'); return }

  // ---- write ----
  const rows = [...authorsBySlug.entries()].map(([slug, c]) => ({
    slug, display_name: c.name, kind: c.kind, source: 'rule' as const,
  }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('authors').upsert(rows.slice(i, i + 500), { onConflict: 'slug' })
    if (error) throw new Error(`authors upsert: ${error.message}`)
  }
  console.log(`\nupserted ${rows.length} authors`)

  const idBySlug = new Map<string, number>()
  for (const a of await fetchAll<{ id: number; slug: string }>('authors', 'id, slug')) idBySlug.set(a.slug, a.id)

  const linkRows = links
    .map((l) => ({ book_id: l.bookId, author_id: idBySlug.get(l.slug), position: l.position }))
    .filter((l): l is { book_id: number; author_id: number; position: number } => l.author_id != null)

  for (let i = 0; i < linkRows.length; i += 500) {
    const { error } = await supabase
      .from('book_authors')
      .upsert(linkRows.slice(i, i + 500), { onConflict: 'book_id,author_id' })
    if (error) throw new Error(`book_authors upsert: ${error.message}`)
  }
  console.log(`upserted ${linkRows.length} book→author links`)
}

main().catch((e) => { console.error(e); process.exit(1) })

/**
 * Phase 2 — why it is not in this file.
 *
 * The ambiguous strings need a model, and three things point it at an edge
 * function rather than this script:
 *
 *   - ANTHROPIC_API_KEY is a Supabase secret. It is deliberately not in the
 *     web app's environment, and putting it there to run a one-off backfill
 *     would be the wrong trade.
 *   - Every other Claude call in this product already runs as an edge function
 *     (classify-book, analyze-books, suggest-bundles).
 *   - This repo pins @anthropic-ai/sdk 0.68.0, which predates
 *     `output_config` — structured outputs would mean either a forced
 *     tool_choice (removed on newer models) or an SDK upgrade whose blast
 *     radius is wider than this job deserves. Edge functions import the SDK by
 *     URL and are versioned independently.
 *
 * Whatever runs it must apply `inventedTokens()` from app/lib/authorName to
 * every result and set `needs_review` on any row that fails. The model is only
 * allowed to split and reorder tokens it was given: the live data holds both
 * "erin russell" (10 copies) and "rachel renée russell" (36), and a silent
 * merge of the two would produce one wrong page and no error anywhere.
 */
