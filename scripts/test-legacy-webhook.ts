/**
 * Regression check: confirm the modified stripe-webhook still routes
 * legacy single-item `payment_intent.succeeded` events to the existing
 * code path (i.e. the iOS flow doesn't break after Phase 1B's multi-
 * item branch is added at the top of the handler).
 *
 * Strategy:
 *   1. Build a payment_intent.succeeded event payload with legacy
 *      single-item metadata (no `type` field). Use listing_id=99999999
 *      so the legacy code reaches "Listing not found" and returns
 *      cleanly — without creating a fake transactions row or marking a
 *      real listing sold.
 *   2. Sign the payload with the staging STRIPE_WEBHOOK_SECRET (read
 *      from the env or passed via stdin), exactly the way Stripe does.
 *   3. POST it to the staging webhook.
 *   4. Expected response: 404 "Listing not found".
 *      Anything else means the modified webhook regressed the legacy
 *      flow and we should NOT promote until it's fixed.
 *
 * Run:  npx tsx scripts/test-legacy-webhook.ts
 *
 * Requires .env.staging with:
 *   NEXT_PUBLIC_SUPABASE_URL (must contain staging branch id)
 *   STRIPE_WEBHOOK_SECRET    (the staging webhook secret)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'

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

function signStripeWebhookPayload(payload: string, secret: string, timestamp: number): string {
  const signedPayload = `${timestamp}.${payload}`
  const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

async function main() {
  const env = loadEnvFile('.env.staging')
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || !supabaseUrl.includes(STAGING_BRANCH_ID)) {
    throw new Error(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL must contain "${STAGING_BRANCH_ID}"`)
  }

  // The webhook secret on the staging Supabase project. We accept it
  // via env or .env.staging. The user can paste it once and not commit.
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET not found. Add it to .env.staging or pass via env:\n' +
        '  STRIPE_WEBHOOK_SECRET="whsec_..." npx tsx scripts/test-legacy-webhook.ts',
    )
  }
  if (!webhookSecret.startsWith('whsec_')) {
    throw new Error('STRIPE_WEBHOOK_SECRET must start with "whsec_"')
  }

  const webhookUrl = `${supabaseUrl}/functions/v1/stripe-webhook`
  console.log(`→ Webhook URL: ${webhookUrl}`)
  console.log(`→ Webhook secret loaded (first 12 chars): ${webhookSecret.slice(0, 12)}…`)

  // Build a payment_intent.succeeded event in the shape Stripe sends.
  // Metadata mirrors what iOS sends: listing_id / buyer_id / seller_id +
  // pence amounts. NO `type: 'multi_item_order'` — that's the discriminator
  // for the new code path. Without it, the webhook should fall through to
  // the legacy single-item branch.
  //
  // listing_id=99999999 → the legacy code's "fetch listing" step will
  // 404 cleanly without writing any fake transactions to the DB.
  const event = {
    id: `evt_legacy_regression_${Date.now()}`,
    object: 'event',
    api_version: '2025-02-24.acacia',
    created: Math.floor(Date.now() / 1000),
    type: 'payment_intent.succeeded',
    livemode: false,
    data: {
      object: {
        id: `pi_legacy_regression_${Date.now()}`,
        object: 'payment_intent',
        amount: 749,
        currency: 'gbp',
        status: 'succeeded',
        latest_charge: `ch_legacy_regression_${Date.now()}`,
        metadata: {
          // Legacy single-item shape — no `type` field
          listing_id: '99999999',
          buyer_id: '00000000-0000-0000-0000-000000000001',
          seller_id: '00000000-0000-0000-0000-000000000002',
          total_amount_pence: '749',
          book_price_pence: '499',
          shipping_charge_pence: '250',
          platform_fee_pence: '100',
          seller_receives_pence: '399',
          platform: 'ios',
        },
      },
    },
  }

  const payload = JSON.stringify(event)
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = signStripeWebhookPayload(payload, webhookSecret, timestamp)

  console.log('→ POSTing signed payment_intent.succeeded with legacy single-item metadata…')
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body: payload,
  })
  const responseText = await res.text()
  console.log(`← HTTP ${res.status}`)
  console.log(`← Body: ${responseText.slice(0, 500)}`)
  console.log()

  // Expected:
  //   HTTP 404 / "Listing not found" — legacy code path reached the
  //   listings fetch and rejected (because listing 99999999 doesn't
  //   exist). This proves the modified webhook routes legacy events
  //   correctly through the unchanged single-item branch.
  //
  // Unexpected (and bad):
  //   400 "Invalid signature"  — webhook secret mismatch
  //   400 "Missing metadata"   — should never happen, we provide all three required fields
  //   200 with multi_item: true → the new branch caught a legacy event by mistake
  //   500 / stack trace        → unhandled exception in legacy path
  if (res.status === 404 && responseText.toLowerCase().includes('listing not found')) {
    console.log('✅ PASS — legacy single-item path reached and returned cleanly.')
    console.log('   The modified stripe-webhook has not regressed the iOS flow.')
    return
  }

  if (responseText.includes('multi_item')) {
    console.error('❌ FAIL — webhook treated a legacy event as multi-item. The branch')
    console.error('   guard in stripe-webhook is probably wrong (matching when it')
    console.error('   shouldn\'t). DO NOT PROMOTE until fixed.')
    process.exit(1)
  }

  if (res.status === 400 && /signature/i.test(responseText)) {
    console.error('❌ FAIL — signature rejected. Either STRIPE_WEBHOOK_SECRET in')
    console.error('   .env.staging is stale, or the webhook secret on Supabase staging')
    console.error('   was rotated. Update one to match the other.')
    process.exit(1)
  }

  console.error('❌ UNEXPECTED RESPONSE — investigate before promoting.')
  console.error(`   Status: ${res.status}`)
  console.error(`   Body:   ${responseText}`)
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
