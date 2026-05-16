/**
 * One-off: create a real Stripe TEST Connect Custom account, fast-forward
 * verification with Stripe's documented test values, attach a test bank,
 * accept TOS, and patch one seeded seller's `user_wallets.stripe_account_id`.
 *
 * After this runs, the seller can receive destination charges in test mode
 * end-to-end on staging.
 *
 * Run:  npx tsx scripts/create-test-connect-account.ts <seller_username>
 *       (default seller: anna_reads_crime)
 *
 * Reads from .env.staging:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   STRIPE_SECRET_KEY  (test-mode sk_test_...)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_USERNAME = 'anna_reads_crime'
const STAGING_BRANCH_ID = 'dbqlgknktoctbchxfsvu'

function loadEnvFile(filename: string): Record<string, string> {
  const filePath = path.resolve(process.cwd(), filename)
  if (!fs.existsSync(filePath)) throw new Error(`Missing ${filename}`)
  const env: Record<string, string> = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

async function main() {
  const env = loadEnvFile('.env.staging')
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  const stripeKey = env.STRIPE_SECRET_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.staging')
  }
  if (!stripeKey) {
    throw new Error('Missing STRIPE_SECRET_KEY (test-mode sk_test_...) in .env.staging')
  }
  if (!stripeKey.startsWith('sk_test_')) {
    throw new Error('STRIPE_SECRET_KEY must be a TEST key (sk_test_...) — refusing to run against live Stripe')
  }
  if (!supabaseUrl.includes(STAGING_BRANCH_ID)) {
    throw new Error(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL must contain the staging branch id "${STAGING_BRANCH_ID}"`)
  }

  const username = process.argv[2] || DEFAULT_USERNAME
  console.log(`→ Target seller: @${username}`)
  console.log(`→ Supabase: ${supabaseUrl}`)

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Find the seller
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, email, username, first_name, last_name')
    .eq('username', username)
    .single()

  if (userErr || !user) {
    throw new Error(`Seller @${username} not found in staging users table: ${userErr?.message ?? 'no rows'}`)
  }
  console.log(`  ✓ Found seller ${user.id} (${user.email})`)

  // 2. Check existing wallet
  const { data: existingWallet } = await supabase
    .from('user_wallets')
    .select('stripe_account_id, stripe_account_status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingWallet?.stripe_account_id?.startsWith('acct_')) {
    console.log(`  ! Seller already has a real Stripe account: ${existingWallet.stripe_account_id}`)
    console.log(`    status=${existingWallet.stripe_account_status}. Will reuse rather than create a new one.`)
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })
    try {
      const acc = await stripe.accounts.retrieve(existingWallet.stripe_account_id)
      console.log(`    charges_enabled=${acc.charges_enabled} details_submitted=${acc.details_submitted}`)
      console.log(`    requirements.currently_due=${JSON.stringify(acc.requirements?.currently_due ?? [])}`)
      if (acc.charges_enabled) {
        console.log('  ✓ Existing account already accepts charges. Nothing to do.')
        return
      }
      console.log('  ! Existing account not enabled — would need manual remediation. Aborting.')
      return
    } catch (err) {
      console.log(`  ! Could not retrieve existing account (${err}). Creating a fresh one instead.`)
    }
  }

  // 3. Create a Custom Connect account with Stripe's test values that pass
  //    verification instantly.
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' })

  console.log('→ Creating Stripe Custom Connect account…')
  const account = await stripe.accounts.create({
    type: 'custom',
    country: 'GB',
    email: user.email ?? `${username}@test.sellyourshelf.com`,
    business_type: 'individual',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      mcc: '5942',
      product_description: 'Sell Your Shelf — staging test seller',
      url: 'https://sellyourshelf.com',
    },
    individual: {
      first_name: user.first_name || 'Jenny',
      last_name: user.last_name || 'Rosen',
      email: user.email ?? undefined,
      phone: '+447700900000',
      dob: { day: 1, month: 1, year: 1901 },
      address: {
        line1: 'address_full_match',
        city: 'London',
        postal_code: 'WC2N 5DU',
        country: 'GB',
      },
      id_number: '000000000',
    },
    tos_acceptance: {
      date: Math.floor(Date.now() / 1000),
      ip: '8.8.8.8',
    },
    // Test bank: Stripe documented sort code/account number for instant verify
    external_account: {
      object: 'bank_account',
      country: 'GB',
      currency: 'gbp',
      account_holder_name: 'Jenny Rosen',
      account_holder_type: 'individual',
      account_number: '00012345',
      routing_number: '108800',
    } as unknown as string, // Stripe SDK types are strict; the runtime accepts this
    settings: {
      payouts: { schedule: { interval: 'manual' } },
    },
    metadata: {
      supabase_user_id: user.id,
      seeded_by: 'scripts/create-test-connect-account.ts',
    },
  })

  console.log(`  ✓ Account created: ${account.id}`)
  console.log(`    charges_enabled=${account.charges_enabled} details_submitted=${account.details_submitted}`)
  if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
    console.log(`    requirements.currently_due=${JSON.stringify(account.requirements.currently_due)}`)
  }

  // 4. Patch user_wallets to use the new real account id.
  console.log('→ Patching user_wallets…')
  const status = account.charges_enabled
    ? 'enabled'
    : account.details_submitted
    ? 'pending'
    : 'restricted'

  const { error: upsertErr } = await supabase
    .from('user_wallets')
    .upsert(
      {
        user_id: user.id,
        stripe_account_id: account.id,
        stripe_account_type: 'custom',
        stripe_account_status: status,
        stripe_onboarded_at: account.charges_enabled ? new Date().toISOString() : null,
        last_stripe_sync_at: new Date().toISOString(),
        stripe_requirements_due: account.requirements?.currently_due ?? [],
        onboarding_step: account.charges_enabled ? 'complete' : 'personal_details',
        available_balance_gbp: 0,
        pending_balance_gbp: 0,
        total_earned_gbp: 0,
      },
      { onConflict: 'user_id' },
    )

  if (upsertErr) throw new Error(`user_wallets upsert failed: ${upsertErr.message}`)
  console.log('  ✓ user_wallets patched')

  console.log()
  console.log('Done. Run an order against @' + username + ' to e2e-test the multi-item flow.')
  console.log(`Account dashboard: https://dashboard.stripe.com/test/connect/accounts/${account.id}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
