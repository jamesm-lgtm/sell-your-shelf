/**
 * Inspect a Stripe Connect account's verification state.
 * Run: npx tsx scripts/check-connect-account.ts <acct_id>
 */
import * as fs from 'node:fs'
import Stripe from 'stripe'

async function main() {
  const id = process.argv[2]
  if (!id) throw new Error('usage: check-connect-account.ts <acct_id>')

  const env = Object.fromEntries(
    fs.readFileSync('.env.staging', 'utf8').split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      }),
  ) as Record<string, string>

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  const acc = await stripe.accounts.retrieve(id)

  console.log('charges_enabled:', acc.charges_enabled)
  console.log('payouts_enabled:', acc.payouts_enabled)
  console.log('details_submitted:', acc.details_submitted)
  console.log('requirements.currently_due:', acc.requirements?.currently_due)
  console.log('requirements.eventually_due:', acc.requirements?.eventually_due)
  console.log('requirements.past_due:', acc.requirements?.past_due)
  console.log('requirements.pending_verification:', acc.requirements?.pending_verification)
  console.log('requirements.disabled_reason:', acc.requirements?.disabled_reason)
  console.log('capabilities.card_payments:', acc.capabilities?.card_payments)
  console.log('capabilities.transfers:', acc.capabilities?.transfers)
  const verification = (acc.individual as unknown as { verification?: { status?: string; details?: string } })?.verification
  console.log('individual.verification:', verification)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
