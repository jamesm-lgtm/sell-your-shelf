/**
 * Cover Migration Script
 *
 * Downloads book cover images from third-party CDNs, uploads them to
 * Supabase Storage via the upload-cover Edge Function, and writes the
 * hosted URLs to the new cover_url_hosted / cover_image_url_hosted columns.
 *
 * Idempotent — only processes rows where the hosted column is NULL.
 *
 * Usage: node scripts/migrate-covers.js
 *
 * Requires .env.local in the project root with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 *   COVER_UPLOAD_API_KEY
 */

const fs = require('fs')
const path = require('path')

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)$/)
  if (match) env[match[1]] = match[2].trim()
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SECRET_KEY
const COVER_API_KEY = env.COVER_UPLOAD_API_KEY
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/upload-cover`

const BATCH_SIZE = 10
const BATCH_DELAY_MS = 1000
const RETRY_DELAY_MS = 2000

if (!SUPABASE_URL || !SUPABASE_KEY || !COVER_API_KEY) {
  console.error('Missing env vars. Ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, and COVER_UPLOAD_API_KEY are in .env.local')
  process.exit(1)
}

async function supabaseQuery(table, select, filters = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`
  for (const [key, value] of Object.entries(filters)) {
    url += `&${key}=${encodeURIComponent(value)}`
  }
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Range': '0-9999',
    },
  })
  return res.json()
}

async function supabaseUpdate(table, id, updates) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(updates),
  })
  return res.ok
}

async function callUploadCover(sourceUrl, storageKey) {
  const res = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': COVER_API_KEY,
    },
    body: JSON.stringify({ sourceUrl, storageKey }),
  })
  return res.json()
}

async function processItem(item, storageKeyPrefix, table, hostedColumn) {
  const sourceUrl = table === 'books' ? item.cover_url : item.cover_image_url
  const storageKey = `${storageKeyPrefix}-${item.id}`

  try {
    const result = await callUploadCover(sourceUrl, storageKey)

    if (result.success) {
      const ok = await supabaseUpdate(table, item.id, { [hostedColumn]: result.hostedUrl })
      if (ok) {
        return { success: true, id: item.id, skipped: result.skipped }
      }
      return { success: false, id: item.id, error: 'db_update_failed' }
    }

    return { success: false, id: item.id, error: result.error }
  } catch (e) {
    return { success: false, id: item.id, error: String(e) }
  }
}

async function processItemWithRetry(item, storageKeyPrefix, table, hostedColumn) {
  let result = await processItem(item, storageKeyPrefix, table, hostedColumn)
  if (!result.success) {
    // Retry once after delay
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
    result = await processItem(item, storageKeyPrefix, table, hostedColumn)
  }
  return result
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function processBatch(items, storageKeyPrefix, table, hostedColumn) {
  return Promise.all(
    items.map(item => processItemWithRetry(item, storageKeyPrefix, table, hostedColumn))
  )
}

async function main() {
  console.log('=== Cover Migration Script ===\n')

  const failures = []

  // ─── Phase 1: books table ───
  console.log('Phase 1: Processing books table...')

  const books = await supabaseQuery('books', 'id,cover_url', {
    'cover_url': 'not.is.null',
    'cover_url_hosted': 'is.null',
    'cover_url': 'not.like.*supabase*',
  })

  // The REST API doesn't support multiple filters on the same column well,
  // so filter client-side
  const booksToProcess = (Array.isArray(books) ? books : []).filter(
    b => b.cover_url && !b.cover_url.includes('supabase')
  )

  console.log(`  Found ${booksToProcess.length} books to process`)

  let booksSuccess = 0
  let booksSkipped = 0
  let booksFailed = 0

  for (let i = 0; i < booksToProcess.length; i += BATCH_SIZE) {
    const batch = booksToProcess.slice(i, i + BATCH_SIZE)
    const results = await processBatch(batch, 'book', 'books', 'cover_url_hosted')

    for (const r of results) {
      if (r.success) {
        if (r.skipped) booksSkipped++
        else booksSuccess++
      } else {
        booksFailed++
        failures.push({ table: 'books', ...r })
      }
    }

    const processed = Math.min(i + BATCH_SIZE, booksToProcess.length)
    process.stdout.write(`  Progress: ${processed}/${booksToProcess.length} (${booksSuccess} uploaded, ${booksSkipped} skipped, ${booksFailed} failed)\r`)

    if (i + BATCH_SIZE < booksToProcess.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  console.log(`\n  Phase 1 complete: ${booksSuccess} uploaded, ${booksSkipped} skipped, ${booksFailed} failed\n`)

  // ─── Phase 2: book_metadata table ───
  console.log('Phase 2: Processing book_metadata table...')

  const metadata = await supabaseQuery('book_metadata', 'id,cover_image_url', {
    'cover_image_url': 'not.is.null',
    'cover_image_url_hosted': 'is.null',
  })

  const metaToProcess = (Array.isArray(metadata) ? metadata : []).filter(
    m => m.cover_image_url && !m.cover_image_url.includes('supabase')
  )

  console.log(`  Found ${metaToProcess.length} book_metadata rows to process`)

  let metaSuccess = 0
  let metaSkipped = 0
  let metaFailed = 0

  for (let i = 0; i < metaToProcess.length; i += BATCH_SIZE) {
    const batch = metaToProcess.slice(i, i + BATCH_SIZE)
    const results = await processBatch(batch, 'meta', 'book_metadata', 'cover_image_url_hosted')

    for (const r of results) {
      if (r.success) {
        if (r.skipped) metaSkipped++
        else metaSuccess++
      } else {
        metaFailed++
        failures.push({ table: 'book_metadata', ...r })
      }
    }

    const processed = Math.min(i + BATCH_SIZE, metaToProcess.length)
    process.stdout.write(`  Progress: ${processed}/${metaToProcess.length} (${metaSuccess} uploaded, ${metaSkipped} skipped, ${metaFailed} failed)\r`)

    if (i + BATCH_SIZE < metaToProcess.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  console.log(`\n  Phase 2 complete: ${metaSuccess} uploaded, ${metaSkipped} skipped, ${metaFailed} failed\n`)

  // ─── Phase 3: Summary ───
  console.log('=== Summary ===')
  console.log(`  Books:         ${booksSuccess} uploaded, ${booksSkipped} skipped, ${booksFailed} failed`)
  console.log(`  Book metadata: ${metaSuccess} uploaded, ${metaSkipped} skipped, ${metaFailed} failed`)
  console.log(`  Total:         ${booksSuccess + metaSuccess} uploaded, ${booksSkipped + metaSkipped} skipped, ${booksFailed + metaFailed} failed`)

  if (failures.length > 0) {
    const failurePath = path.join(__dirname, '..', 'failed_covers.json')
    fs.writeFileSync(failurePath, JSON.stringify(failures, null, 2))
    console.log(`\n  Failures saved to ${failurePath}`)
  }

  console.log('\nDone.')
}

main().catch(console.error)
