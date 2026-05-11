/**
 * Wipe all seed-owned data from staging and re-seed.
 *
 * Deletes (in dependency order): listings, user_wallets, public.users rows,
 * and auth.users entries for the 6 seed personas — then calls runSeed() to
 * rebuild a clean slate.
 *
 * Hard-guarded against running on production via the staging branch ID.
 *
 * Run:  npx tsx scripts/reset-staging-data.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { runSeed } from '../supabase/seed/staging-seed'

const STAGING_BRANCH_ID = 'dbqlgknktoctbchxfsvu'
const SEED_EMAIL_DOMAIN = 'seed.invalid'
const SEED_USERNAMES = [
  'anna_reads_crime',
  'kidsbooks_mum',
  'cookbook_collector',
  'literary_finn',
  'everything_must_go',
  'test_buyer',
]

function loadEnvFile(filename: string): Record<string, string> {
  const filePath = path.resolve(process.cwd(), filename)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filename} in repo root.`)
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

async function main() {
  const env = loadEnvFile('.env.staging')
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.staging.')
  }
  if (!supabaseUrl.includes(STAGING_BRANCH_ID)) {
    throw new Error(
      `Refusing to run: NEXT_PUBLIC_SUPABASE_URL must contain "${STAGING_BRANCH_ID}". Got: ${supabaseUrl}`,
    )
  }

  console.log(`→ Reset target: ${supabaseUrl}`)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Resolve seed user IDs by email (works whether or not public.users rows exist).
  const { data: authList, error: authErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (authErr) throw new Error(`listUsers failed: ${authErr.message}`)

  const seedEmails = new Set(SEED_USERNAMES.map((u) => `${u}@${SEED_EMAIL_DOMAIN}`.toLowerCase()))
  const seedAuthUsers = authList.users.filter((u) => u.email && seedEmails.has(u.email.toLowerCase()))
  const seedUserIds = seedAuthUsers.map((u) => u.id)

  if (seedUserIds.length === 0) {
    console.log('  (no existing seed users found — nothing to delete)')
  } else {
    console.log(`  Found ${seedUserIds.length} existing seed auth user(s)`)

    // Delete in FK-safe order: listings → wallets → public.users → auth.users.
    const { error: listingsErr, count: listingsCount } = await supabase
      .from('listings')
      .delete({ count: 'exact' })
      .in('user_id', seedUserIds)
    if (listingsErr) throw new Error(`delete listings failed: ${listingsErr.message}`)
    console.log(`  ✓ deleted ${listingsCount ?? 0} listing(s)`)

    const { error: walletErr, count: walletCount } = await supabase
      .from('user_wallets')
      .delete({ count: 'exact' })
      .in('user_id', seedUserIds)
    if (walletErr) throw new Error(`delete wallets failed: ${walletErr.message}`)
    console.log(`  ✓ deleted ${walletCount ?? 0} wallet(s)`)

    const { error: userRowErr, count: userRowCount } = await supabase
      .from('users')
      .delete({ count: 'exact' })
      .in('id', seedUserIds)
    if (userRowErr) throw new Error(`delete users rows failed: ${userRowErr.message}`)
    console.log(`  ✓ deleted ${userRowCount ?? 0} public.users row(s)`)

    for (const u of seedAuthUsers) {
      const { error } = await supabase.auth.admin.deleteUser(u.id)
      if (error) throw new Error(`deleteUser(${u.email}) failed: ${error.message}`)
    }
    console.log(`  ✓ deleted ${seedAuthUsers.length} auth user(s)`)
  }

  console.log('')
  console.log('→ Re-seeding…')
  console.log('')
  await runSeed()
}

main().catch((err) => {
  console.error('')
  console.error('Reset failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
