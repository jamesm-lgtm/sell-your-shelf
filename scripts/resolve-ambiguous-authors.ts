/**
 * Phase 2 of the author backfill.
 *
 * Run:
 *   npx tsx scripts/backfill-authors.ts            # phase 1, writes ambiguous-credits.json
 *   npx tsx scripts/resolve-ambiguous-authors.ts --dry-run
 *   npx tsx scripts/resolve-ambiguous-authors.ts
 *
 * Reads the credit strings phase 1 couldn't decide, sends them to the
 * resolve-author-credits edge function, checks what comes back, and writes the
 * ones that pass.
 *
 * The check is the point. The failure that matters here is not a refusal to
 * parse — it's a silent "correction" of an obscure real name to a famous
 * similar one. The catalogue holds both "erin russell" (10 live copies) and
 * "rachel renée russell" (36); folding the first into the second would merge
 * two authors onto one page with no error raised anywhere. So the model is
 * only ever allowed to split and reorder tokens it was given, and anything
 * that introduces a new token is written with needs_review = true, which keeps
 * it off the site until a person has looked.
 */
import * as fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { inventedTokens, slugify, type Contributor } from '../app/lib/authorName'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH = 60

/**
 * --limit N resolves only the first N strings. Nothing about the model path
 * can be tested without a live key, so the first real run should be a cheap
 * one: `--limit 20 --dry-run` costs pennies and shows whether the prompt and
 * the guardrail behave before committing to all 1,385.
 */
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity

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
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = env.SUPABASE_SECRET_KEY!
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

type Ambiguous = { raw: string; bookIds: number[] }
type ModelResult = { raw: string; contributors: Contributor[] }

async function resolveBatch(credits: string[]): Promise<ModelResult[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/resolve-author-credits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({ credits }),
  })
  if (!res.ok) throw new Error(`edge function ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const body = (await res.json()) as { results?: ModelResult[]; error?: string }
  if (body.error) throw new Error(body.error)
  return body.results ?? []
}

async function main() {
  if (!fs.existsSync('ambiguous-credits.json')) {
    throw new Error('ambiguous-credits.json not found — run backfill-authors.ts first')
  }
  const allAmbiguous: Ambiguous[] = JSON.parse(fs.readFileSync('ambiguous-credits.json', 'utf8'))
  const ambiguous = Number.isFinite(LIMIT) ? allAmbiguous.slice(0, LIMIT) : allAmbiguous
  console.log(DRY_RUN ? '— dry run, nothing will be written —\n' : '— writing —\n')
  console.log(
    `${ambiguous.length} distinct credit strings to resolve` +
      (Number.isFinite(LIMIT) ? ` (--limit ${LIMIT} of ${allAmbiguous.length})` : '') +
      '\n',
  )

  const byRaw = new Map(ambiguous.map((a) => [a.raw, a.bookIds]))
  const authorsBySlug = new Map<string, Contributor & { needsReview: boolean }>()
  const links: { bookId: number; slug: string; position: number }[] = []

  let clean = 0
  let flagged = 0
  let empty = 0
  let unmatched = 0
  const flagExamples: string[] = []
  const resolutions: ModelResult[] = []

  for (let i = 0; i < ambiguous.length; i += BATCH) {
    const chunk = ambiguous.slice(i, i + BATCH)
    let results: ModelResult[]
    try {
      results = await resolveBatch(chunk.map((c) => c.raw))
    } catch (err) {
      console.error(`  batch ${i / BATCH + 1} failed:`, err instanceof Error ? err.message : err)
      continue
    }

    for (const r of results) {
      const bookIds = byRaw.get(r.raw)
      // Pair back by the raw string rather than by position, so a reordered or
      // short response loses that entry instead of mislabelling a different one.
      if (!bookIds) { unmatched++; continue }
      if (!r.contributors?.length) { empty++; continue }

      resolutions.push(r)
      const invented = inventedTokens(r.raw, r.contributors)
      const needsReview = invented.length > 0
      if (needsReview) {
        flagged++
        if (flagExamples.length < 8) {
          flagExamples.push(`"${r.raw}" → ${r.contributors.map((c) => c.name).join(' + ')}  [+${invented.join(',')}]`)
        }
      } else {
        clean++
      }

      const seen = new Set<string>()
      r.contributors.forEach((c, pos) => {
        const slug = slugify(c.name)
        if (!slug || seen.has(slug)) return
        seen.add(slug)
        if (!authorsBySlug.has(slug)) authorsBySlug.set(slug, { ...c, needsReview })
        for (const bookId of bookIds) links.push({ bookId, slug, position: pos })
      })
    }
    process.stdout.write(`\r  resolved ${Math.min(i + BATCH, ambiguous.length)}/${ambiguous.length}`)
  }
  console.log('\n')

  /**
   * A dry run has to show the actual mappings, not just counts.
   *
   * inventedTokens() catches a fabricated name, but it cannot catch a WRONG
   * SPLIT: "Malpas, Jodi Ellen" → "Malpas" + "Jodi Ellen" invents no token and
   * passes the guardrail while being completely wrong. The only thing that
   * catches that is a person reading the output, so print it.
   *
   * Splits vs flips is the number to watch. These are all two-part comma
   * strings, and most are expected to be one person written surname-first —
   * so a high split rate means the prompt is mis-reading the comma.
   */
  if (DRY_RUN) {
    const flips = resolutions.filter((r) => r.contributors.length === 1).length
    const splits = resolutions.length - flips
    console.log(`read as ONE person (inversion): ${flips}`)
    console.log(`read as SEVERAL contributors  : ${splits}`)
    console.log('\nevery resolution:')
    for (const r of resolutions) {
      const shape = r.contributors.length === 1 ? 'flip ' : 'split'
      console.log(`  ${shape}  "${r.raw}"  →  ${r.contributors.map((c) => `${c.name} (${c.kind})`).join('  +  ')}`)
    }
    console.log('')
  }

  console.log(`clean (every token was in the input): ${clean}`)
  console.log(`FLAGGED needs_review (invented a token): ${flagged}`)
  console.log(`returned no contributors              : ${empty}`)
  console.log(`came back unmatched to any input       : ${unmatched}`)
  if (flagExamples.length) {
    console.log('\nflagged examples — these stay off the site until reviewed:')
    for (const e of flagExamples) console.log('  ' + e)
  }
  console.log(`\nwould write ${authorsBySlug.size} authors and ${links.length} links`)

  if (DRY_RUN) { console.log('\n(dry run — nothing written)'); return }

  const rows = [...authorsBySlug.entries()].map(([slug, c]) => ({
    slug,
    display_name: c.name,
    kind: c.kind,
    source: 'model' as const,
    needs_review: c.needsReview,
  }))
  // Deliberately NOT upserting over phase-1 rows: a name the deterministic
  // rules already settled is better evidence than a model's opinion, and
  // re-running this should never downgrade `source` from 'rule' to 'model'.
  // Paginated: phase 1 leaves ~9,300 rows here and PostgREST caps an
  // unranged select at 1,000, which would silently report most existing
  // authors as new and then fail on the unique slug constraint.
  const known = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('authors').select('slug').range(from, from + 999)
    if (error) throw new Error(`authors read: ${error.message}`)
    if (!data?.length) break
    for (const a of data) known.add(a.slug)
    if (data.length < 1000) break
  }
  const fresh = rows.filter((r) => !known.has(r.slug))

  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await supabase.from('authors').insert(fresh.slice(i, i + 500))
    if (error) throw new Error(`authors insert: ${error.message}`)
  }
  console.log(`inserted ${fresh.length} new authors (${rows.length - fresh.length} already existed, left alone)`)

  const idBySlug = new Map<string, number>()
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('authors').select('id, slug').range(from, from + 999)
    if (!data?.length) break
    for (const a of data) idBySlug.set(a.slug, a.id)
    if (data.length < 1000) break
  }

  // Same trap phase 1 hit: two contributors on one book can collapse to one
  // slug, and a repeated (book_id, author_id) in a single upsert batch makes
  // Postgres reject the whole thing.
  const seenPair = new Set<string>()
  const linkRows = links
    .map((l) => ({ book_id: l.bookId, author_id: idBySlug.get(l.slug), position: l.position }))
    .filter((l): l is { book_id: number; author_id: number; position: number } => {
      if (l.author_id == null) return false
      const key = `${l.book_id}:${l.author_id}`
      if (seenPair.has(key)) return false
      seenPair.add(key)
      return true
    })

  for (let i = 0; i < linkRows.length; i += 500) {
    const { error } = await supabase
      .from('book_authors')
      .upsert(linkRows.slice(i, i + 500), { onConflict: 'book_id,author_id' })
    if (error) throw new Error(`book_authors upsert: ${error.message}`)
  }
  console.log(`upserted ${linkRows.length} book→author links`)
  console.log('\nReview the flagged rows before clearing needs_review:')
  console.log("  select slug, display_name from authors where needs_review;")
}

main().catch((e) => { console.error(e); process.exit(1) })
