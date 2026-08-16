import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// Live seller balances, straight from Stripe.
//
// The obvious shortcuts are both wrong:
//   * user_wallets.available_balance_gbp is 0 on every row — the
//     increment_seller_earnings RPC it depends on was never created.
//   * Reconstructing from the sales ledger overstates, because it can't see
//     payouts already sent to the seller's bank, Stripe fees or refunds.
//     Measured: a seller whose ledger said £20.85 actually held £10.80.
//
// So we ask Stripe, via the same get-connect-balance function the app uses
// for the seller-facing figure — one source of truth, no drift between what
// the seller sees and what this dashboard shows.
//
// Only sellers with ledger earnings are queried (a handful), not all ~340
// wallets, so this stays a couple of seconds rather than minutes.

type WalletRow = {
  user_id: string
  username: string | null
  email: string | null
  stripe_account_id: string
  stripe_account_status: string | null
  earned_gbp: number
  ebay_owed_gbp: number
  stripe_earned_gbp: number
  spent_gbp: number
  last_sale_at: string | null
}

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword || password !== adminPassword) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: candidates, error } = await supabase.rpc('admin_wallet_candidates')
  if (error) {
    console.error('admin_wallet_candidates failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (candidates ?? []) as WalletRow[]
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SECRET_KEY!

  const enriched = await Promise.all(
    rows.map(async (r) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/get-connect-balance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ stripeAccountId: r.stripe_account_id }),
        })
        if (!res.ok) {
          return { ...r, available_gbp: null, pending_gbp: null, stripe_error: `HTTP ${res.status}` }
        }
        const b = await res.json()
        return {
          ...r,
          available_gbp: Number(b.availableBalanceGbp),
          pending_gbp: Number(b.pendingBalanceGbp),
          stripe_error: null as string | null,
        }
      } catch (err) {
        // A dead or revoked connected account must show as unknown, never
        // as zero — those look identical on a dashboard and mean opposites.
        return {
          ...r,
          available_gbp: null,
          pending_gbp: null,
          stripe_error: err instanceof Error ? err.message : 'fetch failed',
        }
      }
    })
  )

  const sum = (key: 'available_gbp' | 'pending_gbp') =>
    Math.round(enriched.reduce((t, r) => t + (r[key] ?? 0), 0) * 100) / 100

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    total_available_gbp: sum('available_gbp'),
    total_pending_gbp: sum('pending_gbp'),
    total_ebay_owed_gbp:
      Math.round(enriched.reduce((t, r) => t + Number(r.ebay_owed_gbp ?? 0), 0) * 100) / 100,
    spendable_gbp:
      Math.round(
        enriched
          .filter((r) => r.stripe_account_status === 'enabled')
          .reduce((t, r) => t + (r.available_gbp ?? 0), 0) * 100
      ) / 100,
    unreachable: enriched.filter((r) => r.stripe_error).length,
    rows: enriched.sort((a, b) => (b.available_gbp ?? -1) - (a.available_gbp ?? -1)),
  })
}
