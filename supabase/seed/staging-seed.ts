/**
 * Staging seed script for Sell Your Shelf.
 *
 * Creates 5 seller personas, 1 buyer (with £20 wallet credit), and ~50 listings
 * across price bands matching production's shape. Idempotent: re-running updates
 * users/wallets in place and replaces seed-owned listings.
 *
 * Hard-guarded against running on production via the staging branch ID in the
 * Supabase URL. Reads creds from .env.staging in the repo root.
 *
 * Run:  npx tsx supabase/seed/staging-seed.ts
 *
 * .env.staging must contain:
 *   NEXT_PUBLIC_SUPABASE_URL=https://dbqlgknktoctbchxfsvu.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

const STAGING_BRANCH_ID = 'dbqlgknktoctbchxfsvu'
const SEED_EMAIL_DOMAIN = 'seed.invalid'

// ---------- env loading ----------

function loadEnvFile(filename: string): Record<string, string> {
  const filePath = path.resolve(process.cwd(), filename)
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing ${filename} in repo root. Create it with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`,
    )
  }
  const env: Record<string, string> = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

// ---------- persona + book seed data ----------

type Persona = {
  username: string
  name: string
  bio: string
  location: string
  firstName: string
  lastName: string
}

const SELLERS: Persona[] = [
  {
    username: 'anna_reads_crime',
    name: 'Anna Whittaker',
    firstName: 'Anna',
    lastName: 'Whittaker',
    bio: 'Crime & thriller hoarder. Trimming the shelves.',
    location: 'Manchester',
  },
  {
    username: 'kidsbooks_mum',
    name: 'Sarah Patel',
    firstName: 'Sarah',
    lastName: 'Patel',
    bio: 'My kids outgrew these. Hopefully yours will love them.',
    location: 'Reading',
  },
  {
    username: 'cookbook_collector',
    name: 'Daniel Holloway',
    firstName: 'Daniel',
    lastName: 'Holloway',
    bio: 'Hardback cookery editions, mostly unmarked.',
    location: 'Bristol',
  },
  {
    username: 'literary_finn',
    name: "Finn O'Carroll",
    firstName: 'Finn',
    lastName: "O'Carroll",
    bio: 'Booker longlists and quiet stunners.',
    location: 'Edinburgh',
  },
  {
    username: 'everything_must_go',
    name: 'Megan Iyer',
    firstName: 'Megan',
    lastName: 'Iyer',
    bio: 'House move sale — everything must go.',
    location: 'London',
  },
]

const BUYER: Persona = {
  username: 'test_buyer',
  name: 'Test Buyer',
  firstName: 'Test',
  lastName: 'Buyer',
  bio: 'Test buyer account for QA.',
  location: 'London',
}

type PriceBand = '0-4' | '4-7' | '7-12' | '12-25' | '25+'

type BookSeed = {
  isbn: string
  title: string
  author: string
  seller: string
  band: PriceBand
}

// 50 books. Distribution targets: 22 / 21 / 4 / 2 / 1 across bands 0-4 / 4-7 / 7-12 / 12-25 / 25+.
// ISBNs are real ISBN-13s for well-known UK editions where possible.
const BOOKS: BookSeed[] = [
  // anna_reads_crime — 10 (4@0-4, 5@4-7, 1@7-12)
  { isbn: '9780552145817', title: 'The Girl with the Dragon Tattoo', author: 'Stieg Larsson', seller: 'anna_reads_crime', band: '0-4' },
  { isbn: '9780062073488', title: 'And Then There Were None', author: 'Agatha Christie', seller: 'anna_reads_crime', band: '0-4' },
  { isbn: '9780099436935', title: 'Killing Floor', author: 'Lee Child', seller: 'anna_reads_crime', band: '0-4' },
  { isbn: '9780099563662', title: 'Big Little Lies', author: 'Liane Moriarty', seller: 'anna_reads_crime', band: '0-4' },
  { isbn: '9781472254276', title: 'The Thursday Murder Club', author: 'Richard Osman', seller: 'anna_reads_crime', band: '4-7' },
  { isbn: '9780553820041', title: "The Cuckoo's Calling", author: 'Robert Galbraith', seller: 'anna_reads_crime', band: '4-7' },
  { isbn: '9780241956793', title: 'I Let You Go', author: 'Clare Mackintosh', seller: 'anna_reads_crime', band: '4-7' },
  { isbn: '9781405935098', title: 'The Couple Next Door', author: 'Shari Lapena', seller: 'anna_reads_crime', band: '4-7' },
  { isbn: '9780241980330', title: 'The Silent Patient', author: 'Alex Michaelides', seller: 'anna_reads_crime', band: '4-7' },
  { isbn: '9780552774017', title: 'Gone Girl', author: 'Gillian Flynn', seller: 'anna_reads_crime', band: '7-12' },

  // kidsbooks_mum — 12 (8@0-4, 4@4-7)
  { isbn: '9780141354828', title: 'The Gruffalo', author: 'Julia Donaldson', seller: 'kidsbooks_mum', band: '0-4' },
  { isbn: '9780241430699', title: 'Room on the Broom', author: 'Julia Donaldson', seller: 'kidsbooks_mum', band: '0-4' },
  { isbn: '9780141301068', title: 'Matilda', author: 'Roald Dahl', seller: 'kidsbooks_mum', band: '0-4' },
  { isbn: '9780141501963', title: 'Charlie and the Chocolate Factory', author: 'Roald Dahl', seller: 'kidsbooks_mum', band: '0-4' },
  { isbn: '9780141319100', title: 'James and the Giant Peach', author: 'Roald Dahl', seller: 'kidsbooks_mum', band: '0-4' },
  { isbn: '9780241003008', title: "We're Going on a Bear Hunt", author: 'Michael Rosen', seller: 'kidsbooks_mum', band: '0-4' },
  { isbn: '9781407170749', title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum', seller: 'kidsbooks_mum', band: '0-4' },
  { isbn: '9780333960226', title: 'Where the Wild Things Are', author: 'Maurice Sendak', seller: 'kidsbooks_mum', band: '0-4' },
  { isbn: '9780747532699', title: "Harry Potter and the Philosopher's Stone", author: 'J.K. Rowling', seller: 'kidsbooks_mum', band: '4-7' },
  { isbn: '9780141337142', title: 'The Lion, the Witch and the Wardrobe', author: 'C.S. Lewis', seller: 'kidsbooks_mum', band: '4-7' },
  { isbn: '9780718198015', title: 'The Boy at the Back of the Class', author: 'Onjali Q. Raúf', seller: 'kidsbooks_mum', band: '4-7' },
  { isbn: '9780241364758', title: 'The Boy, the Mole, the Fox and the Horse', author: 'Charlie Mackesy', seller: 'kidsbooks_mum', band: '4-7' },

  // cookbook_collector — 8 (1@0-4, 3@4-7, 2@7-12, 1@12-25, 1@25+)
  { isbn: '9780718187736', title: "Bake Off Crew's Big Book of Baking", author: 'The Great British Bake Off Team', seller: 'cookbook_collector', band: '0-4' },
  { isbn: '9781845336806', title: "Jamie's 30-Minute Meals", author: 'Jamie Oliver', seller: 'cookbook_collector', band: '4-7' },
  { isbn: '9781784725303', title: 'The Roasting Tin', author: 'Rukmini Iyer', seller: 'cookbook_collector', band: '4-7' },
  { isbn: '9780241456057', title: 'Mob Kitchen', author: 'Ben Lebus', seller: 'cookbook_collector', band: '4-7' },
  { isbn: '9780241431870', title: 'Ottolenghi Simple', author: 'Yotam Ottolenghi', seller: 'cookbook_collector', band: '7-12' },
  { isbn: '9780718188276', title: 'Eat Better Forever', author: 'Hugh Fearnley-Whittingstall', seller: 'cookbook_collector', band: '7-12' },
  { isbn: '9780241397626', title: 'Dishoom', author: 'Shamil Thakrar', seller: 'cookbook_collector', band: '12-25' },
  { isbn: '9780241406038', title: 'Eat Up!', author: 'Ruby Tandoh', seller: 'cookbook_collector', band: '25+' },

  // literary_finn — 10 (3@0-4, 6@4-7, 1@7-12)
  { isbn: '9780099511038', title: 'Atonement', author: 'Ian McEwan', seller: 'literary_finn', band: '0-4' },
  { isbn: '9780099273738', title: 'The Curious Incident of the Dog in the Night-Time', author: 'Mark Haddon', seller: 'literary_finn', band: '0-4' },
  { isbn: '9780571227280', title: 'Never Let Me Go', author: 'Kazuo Ishiguro', seller: 'literary_finn', band: '0-4' },
  { isbn: '9780571258093', title: 'Normal People', author: 'Sally Rooney', seller: 'literary_finn', band: '4-7' },
  { isbn: '9780571334650', title: 'Conversations with Friends', author: 'Sally Rooney', seller: 'literary_finn', band: '4-7' },
  { isbn: '9780241470749', title: 'Beautiful World, Where Are You', author: 'Sally Rooney', seller: 'literary_finn', band: '4-7' },
  { isbn: '9780241983379', title: 'Girl, Woman, Other', author: 'Bernardine Evaristo', seller: 'literary_finn', band: '4-7' },
  { isbn: '9781447299585', title: 'Where the Crawdads Sing', author: 'Delia Owens', seller: 'literary_finn', band: '4-7' },
  { isbn: '9780571295272', title: 'The Light Between Oceans', author: 'M.L. Stedman', seller: 'literary_finn', band: '4-7' },
  { isbn: '9781529118506', title: 'Klara and the Sun', author: 'Kazuo Ishiguro', seller: 'literary_finn', band: '7-12' },

  // everything_must_go — 10 (6@0-4, 3@4-7, 1@12-25)
  { isbn: '9780099549482', title: '1Q84', author: 'Haruki Murakami', seller: 'everything_must_go', band: '0-4' },
  { isbn: '9780099475477', title: "The Time Traveler's Wife", author: 'Audrey Niffenegger', seller: 'everything_must_go', band: '0-4' },
  { isbn: '9781784703936', title: 'The Power', author: 'Naomi Alderman', seller: 'everything_must_go', band: '0-4' },
  { isbn: '9780062316097', title: 'The Subtle Art of Not Giving a F*ck', author: 'Mark Manson', seller: 'everything_must_go', band: '0-4' },
  { isbn: '9780241404997', title: 'Educated', author: 'Tara Westover', seller: 'everything_must_go', band: '0-4' },
  { isbn: '9780099589969', title: 'Becoming', author: 'Michelle Obama', seller: 'everything_must_go', band: '0-4' },
  { isbn: '9780241430613', title: 'Atomic Habits', author: 'James Clear', seller: 'everything_must_go', band: '4-7' },
  { isbn: '9780241981672', title: 'Sapiens', author: 'Yuval Noah Harari', seller: 'everything_must_go', band: '4-7' },
  { isbn: '9780099583493', title: 'The Goldfinch', author: 'Donna Tartt', seller: 'everything_must_go', band: '4-7' },
  { isbn: '9780571331437', title: 'Mr Loverman', author: 'Bernardine Evaristo', seller: 'everything_must_go', band: '12-25' },
]

const CONDITIONS = ['like_new', 'very_good', 'good', 'acceptable'] as const

// Format weighting per persona — kids/lit/decluttering skew paperback,
// cookbook collector skews hardback (matches the "hardback cookery" persona).
const HARDBACK_PROBABILITY: Record<string, number> = {
  anna_reads_crime: 0.2,
  kidsbooks_mum: 0.2,
  cookbook_collector: 0.8,
  literary_finn: 0.3,
  everything_must_go: 0.25,
}

// ---------- deterministic PRNG ----------
// Mulberry32: tiny, fast, good enough for seed jitter. Seeded from a string hash
// so the same book/seller pair always produces the same price/condition/date.

function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = t
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function pickPriceForBand(rng: () => number, band: PriceBand): number {
  const ladders: Record<PriceBand, number[]> = {
    '0-4': [1.5, 1.99, 2.5, 2.99, 3.5, 3.99],
    '4-7': [4.0, 4.5, 4.99, 5.5, 5.99, 6.5, 6.99],
    '7-12': [7.5, 8.99, 9.99, 10.99, 11.99],
    '12-25': [13.99, 16.99, 19.99, 22.5],
    '25+': [27.5, 35.0, 45.0],
  }
  const ladder = ladders[band]
  return ladder[Math.floor(rng() * ladder.length)]
}

function bandFromPrice(price: number): PriceBand {
  if (price < 4) return '0-4'
  if (price < 7) return '4-7'
  if (price < 12) return '7-12'
  if (price < 25) return '12-25'
  return '25+'
}

// ---------- text helpers (for books inserts) ----------

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

// ---------- Cover fetching (Open Library primary, Google Books fallback) ----------

type GoogleBooksResponse = {
  items?: Array<{
    volumeInfo?: {
      imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    }
  }>
}

type OpenLibrarySearchResponse = {
  docs?: Array<{ cover_i?: number }>
}

async function fetchCoverFromOpenLibrary(isbn: string): Promise<string | null> {
  // Direct cover-by-isbn endpoint has poor coverage; search.json is broader.
  // It returns a numeric cover_i which we can convert into a covers.openlibrary.org URL.
  const url = `https://openlibrary.org/search.json?q=isbn:${encodeURIComponent(isbn)}&fields=cover_i&limit=1`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    const body = (await res.json()) as OpenLibrarySearchResponse
    const coverId = body.docs?.[0]?.cover_i
    if (!coverId) return null
    return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
  } catch {
    return null
  }
}

async function fetchCoverFromGoogleBooks(isbn: string): Promise<string | null> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    const body = (await res.json()) as GoogleBooksResponse
    const links = body.items?.[0]?.volumeInfo?.imageLinks
    const cover = links?.thumbnail ?? links?.smallThumbnail ?? null
    return cover ? cover.replace(/^http:\/\//, 'https://') : null
  } catch {
    return null
  }
}

async function fetchCover(isbn: string): Promise<string | null> {
  const fromOL = await fetchCoverFromOpenLibrary(isbn)
  if (fromOL) return fromOL
  return fetchCoverFromGoogleBooks(isbn)
}

// ---------- supabase helpers ----------

async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ id: string } | null> {
  // listUsers is paginated; for ~6 seed users, page 1 (default 50/page) is enough.
  // If we ever exceed that we'd need to walk pages — fine to revisit then.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw error
  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  return match ? { id: match.id } : null
}

async function ensureAuthUser(
  supabase: SupabaseClient,
  email: string,
  metadata: Record<string, unknown>,
): Promise<string> {
  const existing = await findAuthUserByEmail(supabase, email)
  if (existing) return existing.id

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: 'StagingSeed!2026',
    user_metadata: metadata,
  })
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`)
  if (!data.user) throw new Error(`createUser(${email}) returned no user`)
  return data.user.id
}

async function ensureUserRow(supabase: SupabaseClient, userId: string, persona: Persona) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('users').upsert(
    {
      id: userId,
      username: persona.username,
      name: persona.name,
      first_name: persona.firstName,
      last_name: persona.lastName,
      bio: persona.bio,
      location: persona.location,
      email: `${persona.username}@${SEED_EMAIL_DOMAIN}`,
      is_anonymous: false,
      onboarding_complete: true,
      tos_accepted_at: now,
      registered_at: now,
    },
    { onConflict: 'id' },
  )
  if (error) throw new Error(`upsert users(${persona.username}) failed: ${error.message}`)
}

async function ensureSellerWallet(supabase: SupabaseClient, userId: string, persona: Persona) {
  const now = new Date().toISOString()
  const { error } = await supabase.from('user_wallets').upsert(
    {
      user_id: userId,
      stripe_account_id: `acct_test_${persona.username}`,
      stripe_account_status: 'enabled',
      stripe_account_type: 'express',
      stripe_onboarded_at: now,
      onboarding_step: 'complete',
      available_balance_gbp: 0,
      pending_balance_gbp: 0,
      total_earned_gbp: 0,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(`upsert wallet(${persona.username}) failed: ${error.message}`)
}

async function ensureBuyerWallet(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.from('user_wallets').upsert(
    {
      user_id: userId,
      available_balance_gbp: 20.0,
      pending_balance_gbp: 0,
      total_earned_gbp: 0,
      onboarding_step: 'not_started',
    },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(`upsert buyer wallet failed: ${error.message}`)
}

// ---------- books ----------

type BookRow = { id: number; isbn: string | null; cover_url: string | null }

async function ensureBooks(supabase: SupabaseClient): Promise<Map<string, number>> {
  const isbns = Array.from(new Set(BOOKS.map((b) => b.isbn)))

  // 1. Find any books that already exist for these ISBNs.
  const { data: existingRaw, error: lookupErr } = await supabase
    .from('books')
    .select('id, isbn, cover_url')
    .in('isbn', isbns)
  if (lookupErr) throw new Error(`books lookup failed: ${lookupErr.message}`)
  const existing = (existingRaw ?? []) as BookRow[]

  const isbnToId = new Map<string, number>()
  const existingByIsbn = new Map<string, BookRow>()
  for (const row of existing) {
    if (row.isbn) {
      existingByIsbn.set(row.isbn, row)
      isbnToId.set(row.isbn, row.id)
    }
  }

  const missingIsbns = isbns.filter((isbn) => !isbnToId.has(isbn))
  const needCoverPatch = existing.filter((r) => r.isbn && !r.cover_url)

  console.log(
    `  ↻ books: ${existing.length} already in DB, ${missingIsbns.length} to insert, ${needCoverPatch.length} need cover backfill`,
  )

  // 2. Fetch covers for missing + cover-less existing rows, in small parallel batches.
  const allFetches = [...missingIsbns, ...needCoverPatch.map((r) => r.isbn!)]
  const coverByIsbn = new Map<string, string | null>()
  const batchSize = 5
  for (let i = 0; i < allFetches.length; i += batchSize) {
    const slice = allFetches.slice(i, i + batchSize)
    const results = await Promise.all(slice.map((isbn) => fetchCover(isbn)))
    slice.forEach((isbn, j) => coverByIsbn.set(isbn, results[j]))
  }
  const hits = Array.from(coverByIsbn.values()).filter(Boolean).length
  if (allFetches.length > 0) {
    console.log(`  ↻ fetched covers: ${hits}/${allFetches.length} resolved (Open Library + Google Books fallback)`)
  }

  // 3. Patch cover_url on existing rows that were missing it.
  for (const row of needCoverPatch) {
    const cover = coverByIsbn.get(row.isbn!)
    if (!cover) continue
    const { error } = await supabase.from('books').update({ cover_url: cover }).eq('id', row.id)
    if (error) throw new Error(`update books cover for isbn ${row.isbn}: ${error.message}`)
  }

  // 4. Insert missing books. Try without id first (assumes IDENTITY); if that
  //    fails on the NOT-NULL id, retry with manually assigned ids from max+1.
  if (missingIsbns.length > 0) {
    const seedByIsbn = new Map<string, BookSeed>()
    for (const b of BOOKS) if (!seedByIsbn.has(b.isbn)) seedByIsbn.set(b.isbn, b)

    type BookInsert = {
      id?: number
      isbn: string
      title: string
      author: string
      title_normalized: string
      author_normalized: string
      slug: string
      cover_url: string | null
    }

    const buildRow = (isbn: string, id?: number): BookInsert => {
      const seed = seedByIsbn.get(isbn)!
      return {
        ...(id !== undefined ? { id } : {}),
        isbn,
        title: seed.title,
        author: seed.author,
        title_normalized: normalizeText(seed.title),
        author_normalized: normalizeText(seed.author),
        slug: `${slugify(seed.title)}-${isbn.slice(-4)}`,
        cover_url: coverByIsbn.get(isbn) ?? null,
      }
    }

    const initialRows = missingIsbns.map((isbn) => buildRow(isbn))
    const { data: inserted, error: insertErr } = await supabase
      .from('books')
      .insert(initialRows)
      .select('id, isbn')

    if (insertErr) {
      const msg = insertErr.message.toLowerCase()
      const isNullIdError = msg.includes('null value') && msg.includes('"id"')
      if (!isNullIdError) {
        throw new Error(`books insert failed: ${insertErr.message}`)
      }
      console.log('  ! books.id has no auto-default — falling back to manual id assignment')
      const { data: maxRow, error: maxErr } = await supabase
        .from('books')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (maxErr) throw new Error(`books max(id) lookup failed: ${maxErr.message}`)
      let nextId = (maxRow?.id ?? 0) + 1
      const manualRows = missingIsbns.map((isbn) => buildRow(isbn, nextId++))
      const { data: inserted2, error: retryErr } = await supabase
        .from('books')
        .insert(manualRows)
        .select('id, isbn')
      if (retryErr) throw new Error(`books insert (manual ids) failed: ${retryErr.message}`)
      for (const row of (inserted2 ?? []) as BookRow[]) {
        if (row.isbn) isbnToId.set(row.isbn, row.id)
      }
    } else {
      for (const row of (inserted ?? []) as BookRow[]) {
        if (row.isbn) isbnToId.set(row.isbn, row.id)
      }
    }
    console.log(`  ✓ inserted ${missingIsbns.length} new book row(s)`)
  }

  return isbnToId
}

// ---------- listing generation ----------

type ListingRow = {
  user_id: string
  book_id: number | null
  title: string
  author: string
  isbn: string
  asking_price_gbp: number
  suggested_price_gbp: number
  condition: string
  format: 'paperback' | 'hardback'
  status: 'active'
  created_at: string
  notes: string
}

function buildListings(
  sellerIds: Map<string, string>,
  bookIds: Map<string, number>,
): ListingRow[] {
  const rows: ListingRow[] = []
  const nowMs = Date.now()
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000

  for (const book of BOOKS) {
    const userId = sellerIds.get(book.seller)
    if (!userId) throw new Error(`No user id for seller ${book.seller}`)

    const rng = mulberry32(hashString(`${book.isbn}|${book.seller}`))
    const askingPrice = pickPriceForBand(rng, book.band)

    // 70% suggested == asking; 30% diverges by ±5–20%.
    let suggestedPrice = askingPrice
    if (rng() > 0.7) {
      const swing = 0.05 + rng() * 0.15
      const sign = rng() < 0.5 ? -1 : 1
      suggestedPrice = Math.max(0.5, Math.round((askingPrice * (1 + sign * swing)) * 100) / 100)
    }

    const condition = CONDITIONS[Math.floor(rng() * CONDITIONS.length)]

    const hardbackProb = HARDBACK_PROBABILITY[book.seller] ?? 0.25
    const format: 'paperback' | 'hardback' = rng() < hardbackProb ? 'hardback' : 'paperback'

    // Spread created_at over the last 60 days, deterministically.
    const ageMs = Math.floor(rng() * sixtyDaysMs)
    const createdAt = new Date(nowMs - ageMs).toISOString()

    rows.push({
      user_id: userId,
      book_id: bookIds.get(book.isbn) ?? null,
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      asking_price_gbp: askingPrice,
      suggested_price_gbp: suggestedPrice,
      condition,
      format,
      status: 'active',
      created_at: createdAt,
      notes: 'seed:staging-seed',
    })
  }

  return rows
}

// ---------- main ----------

export async function runSeed(): Promise<void> {
  const env = loadEnvFile('.env.staging')
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.staging.')
  }
  if (!supabaseUrl.includes(STAGING_BRANCH_ID)) {
    throw new Error(
      `Refusing to run: NEXT_PUBLIC_SUPABASE_URL must contain the staging branch ID "${STAGING_BRANCH_ID}". Got: ${supabaseUrl}`,
    )
  }

  console.log(`→ Connecting to ${supabaseUrl}`)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Sellers
  const sellerIds = new Map<string, string>()
  for (const persona of SELLERS) {
    const email = `${persona.username}@${SEED_EMAIL_DOMAIN}`
    const id = await ensureAuthUser(supabase, email, { username: persona.username, seed: true })
    await ensureUserRow(supabase, id, persona)
    await ensureSellerWallet(supabase, id, persona)
    sellerIds.set(persona.username, id)
    console.log(`  ✓ seller ${persona.username} (${id.slice(0, 8)}…)`)
  }

  // 2. Buyer
  const buyerEmail = `${BUYER.username}@${SEED_EMAIL_DOMAIN}`
  const buyerId = await ensureAuthUser(supabase, buyerEmail, { username: BUYER.username, seed: true })
  await ensureUserRow(supabase, buyerId, BUYER)
  await ensureBuyerWallet(supabase, buyerId)
  console.log(`  ✓ buyer ${BUYER.username} (${buyerId.slice(0, 8)}…)  £20 wallet`)

  // 3. Books — find/insert one books row per ISBN with a real cover.
  const bookIds = await ensureBooks(supabase)

  // 4. Listings — delete any existing seed-owned listings, then bulk insert fresh ones.
  const sellerIdArray = Array.from(sellerIds.values())
  const { error: delErr, count: delCount } = await supabase
    .from('listings')
    .delete({ count: 'exact' })
    .in('user_id', sellerIdArray)
  if (delErr) throw new Error(`delete existing listings failed: ${delErr.message}`)
  console.log(`  ✓ cleared ${delCount ?? 0} existing seed listing(s)`)

  const listingRows = buildListings(sellerIds, bookIds)
  const { error: insErr } = await supabase.from('listings').insert(listingRows)
  if (insErr) throw new Error(`insert listings failed: ${insErr.message}`)

  // 5. Summary (from the input rows)
  const plannedBand: Record<PriceBand, number> = { '0-4': 0, '4-7': 0, '7-12': 0, '12-25': 0, '25+': 0 }
  for (const row of listingRows) plannedBand[bandFromPrice(row.asking_price_gbp)]++
  const total = listingRows.length

  console.log('')
  console.log(`Inserted: ${SELLERS.length} sellers, 1 buyer, ${total} listings`)
  console.log('Price band breakdown (planned):')
  for (const band of ['0-4', '4-7', '7-12', '12-25', '25+'] as PriceBand[]) {
    const n = plannedBand[band]
    const pct = ((n / total) * 100).toFixed(0)
    console.log(`  £${band}: ${n} (${pct}%)`)
  }

  // 6. Verification — query DB and count by band ourselves.
  const { data: verifyRows, error: verifyErr } = await supabase
    .from('listings')
    .select('asking_price_gbp')
    .in('user_id', sellerIdArray)
  if (verifyErr) throw new Error(`verification select failed: ${verifyErr.message}`)

  const actualBand: Record<PriceBand, number> = { '0-4': 0, '4-7': 0, '7-12': 0, '12-25': 0, '25+': 0 }
  for (const row of verifyRows ?? []) {
    const price = Number(row.asking_price_gbp)
    if (!Number.isFinite(price)) continue
    actualBand[bandFromPrice(price)]++
  }
  const actualTotal = verifyRows?.length ?? 0

  console.log('')
  console.log(`Verification (SELECT from DB): ${actualTotal} listings owned by seed sellers`)
  for (const band of ['0-4', '4-7', '7-12', '12-25', '25+'] as PriceBand[]) {
    const n = actualBand[band]
    const pct = actualTotal ? ((n / actualTotal) * 100).toFixed(0) : '0'
    const match = n === plannedBand[band] ? '✓' : '✗'
    console.log(`  £${band}: ${n} (${pct}%) ${match}`)
  }

  if (actualTotal !== total) {
    throw new Error(
      `Verification mismatch: planned ${total} listings, DB has ${actualTotal}. Investigate before relying on this seed.`,
    )
  }
}

// Only run when executed directly (not when imported by reset-staging-data.ts).
const isDirect = (() => {
  try {
    const invoked = process.argv[1] ? path.resolve(process.argv[1]) : ''
    const self = new URL(import.meta.url).pathname
    return invoked === self
  } catch {
    return true
  }
})()

if (isDirect) {
  runSeed().catch((err) => {
    console.error('')
    console.error('Seed failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
