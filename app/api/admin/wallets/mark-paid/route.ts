import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// Records that a seller has been paid OUTSIDE Stripe — almost always an
// eBay cross-list payout, which never enters their Connect balance.
//
// This writes a ledger row. It does NOT move money: the transfer happens in
// your banking app, and this is the record that it happened. Named and
// worded throughout so nobody mistakes the button for a payment rail.
export async function POST(req: NextRequest) {
  const { password, userId, amountGbp, note, method } = await req.json()

  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword || password !== adminPassword) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const amount = Number(amountGbp)
  if (!userId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'userId and a positive amountGbp are required' }, { status: 400 })
  }

  // Never let a typo record more than is actually outstanding — that would
  // silently turn into a negative debt and hide a real one later.
  const { data: candidates, error: candErr } = await supabase.rpc('admin_wallet_candidates')
  if (candErr) {
    return NextResponse.json({ error: candErr.message }, { status: 500 })
  }
  const row = (candidates ?? []).find(
    (c: { user_id: string }) => c.user_id === userId
  ) as { ebay_outstanding_gbp: number } | undefined

  if (!row) {
    return NextResponse.json({ error: 'seller has no earnings on record' }, { status: 400 })
  }
  const outstanding = Number(row.ebay_outstanding_gbp)
  if (amount > outstanding + 0.005) {
    return NextResponse.json(
      { error: `amount £${amount.toFixed(2)} exceeds outstanding £${outstanding.toFixed(2)}` },
      { status: 400 }
    )
  }

  const { error } = await supabase.from('manual_payouts').insert({
    user_id: userId,
    amount_gbp: amount,
    channel: 'ebay',
    method: method ?? null,
    note: note ?? null,
    recorded_by: 'admin',
  })

  if (error) {
    console.error('manual_payouts insert failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recorded_gbp: amount })
}
