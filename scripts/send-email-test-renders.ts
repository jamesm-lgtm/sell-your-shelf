/**
 * Send test renders of the three rewritten multi-item email templates to a
 * fixed recipient for visual review.
 *
 * Run:  npx tsx scripts/send-email-test-renders.ts [recipient-email]
 *
 * Defaults to james@sellyourshelf.com. Hits the staging send-email function;
 * relies on RESEND_API_KEY being set as a function secret on the staging
 * Supabase project.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

const DEFAULT_RECIPIENT = 'james@sellyourshelf.com'

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
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.staging')
  }

  const recipient = process.argv[2] || DEFAULT_RECIPIENT
  console.log(`→ Sending test renders to ${recipient} via ${supabaseUrl}`)

  // Sample multi-item data — three books, varied authors, threshold crossed
  const items = [
    { title: 'Atomic Habits', author: 'James Clear', priceGbp: 4.5, platformFeeGbp: 1.0, payoutGbp: 3.5 },
    { title: 'The Midnight Library', author: 'Matt Haig', priceGbp: 5.99, platformFeeGbp: 1.198, payoutGbp: 4.792 },
    { title: 'Educated', author: 'Tara Westover', priceGbp: 3.75, platformFeeGbp: 1.0, payoutGbp: 2.75 },
  ]

  const subtotalGbp = 14.24
  const shippingGbp = 0 // free, over £10
  const totalGbp = 14.24
  const walletAppliedGbp = 0
  const cardChargedGbp = 14.24
  const totalPlatformFeeGbp = 3.198
  const totalPayoutGbp = 11.042
  const orderId = 'test-order-render-0001'

  const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${serviceKey}`,
  }

  const tests = [
    {
      label: 'order_confirmation (buyer, multi-item)',
      body: {
        type: 'order_confirmation',
        to: recipient,
        data: {
          buyerName: 'James',
          sellerUsername: 'anna_reads_crime',
          items,
          subtotalGbp,
          shippingGbp,
          totalGbp,
          walletAppliedGbp,
          cardChargedGbp,
          shippingAddress: {
            name: 'James Mumberson',
            line1: '1 Sample Street',
            city: 'London',
            postcode: 'E1 1AA',
          },
          estimatedDeliveryDays: '2-3 working days',
          orderId,
        },
      },
    },
    {
      label: 'new_sale (seller, multi-item)',
      body: {
        type: 'new_sale',
        to: recipient,
        data: {
          sellerName: 'Anna',
          buyerName: 'james_buys_books',
          items,
          subtotalGbp,
          totalPlatformFeeGbp,
          totalPayoutGbp,
          parcelTier: 'small',
          orderId,
        },
      },
    },
    {
      label: 'order_shipped (buyer, multi-item)',
      body: {
        type: 'order_shipped',
        to: recipient,
        data: {
          buyerName: 'James',
          items: items.map((it) => ({ title: it.title, author: it.author })),
          trackingNumber: 'JD0002800001234',
          trackingUrl: 'https://www.yodel.co.uk/track/JD0002800001234',
          estimatedDeliveryDays: '2-3 working days',
          orderId,
        },
      },
    },
  ]

  for (const t of tests) {
    console.log(`  • ${t.label}`)
    const res = await fetch(sendEmailUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(t.body),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error(`    ✗ HTTP ${res.status}:`, result)
    } else {
      console.log(`    ✓ sent (id ${result.id ?? '?'})`)
    }
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
