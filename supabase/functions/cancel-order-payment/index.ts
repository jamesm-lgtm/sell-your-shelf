// cancel-order-payment
//
// Client-initiated rollback for a payment_pending multi-item order. Called
// by the mobile OrderCheckoutScreen when the Stripe Payment Sheet fails to
// confirm on device after create-order-payment-intent has already
// (a) charged the buyer's Connect wallet for the wallet portion, and/or
// (b) created a PaymentIntent for the card portion.
//
// Without this endpoint, a torn checkout leaves the wallet portion
// stranded — the buyer's balance is debited but no order ever pays.
//
// Idempotent: re-running on an already-cancelled or already-paid order
// returns 200 with no side effects.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17'

type StripeMode = 'live' | 'test'
const _stripeByMode: Partial<Record<StripeMode, Stripe>> = {}
function getStripe(mode: StripeMode): Stripe {
  const cached = _stripeByMode[mode]
  if (cached) return cached
  const envKey = mode === 'test' ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY'
  const key = Deno.env.get(envKey)
  if (!key) throw new Error(`${envKey} is not configured on this project`)
  const stripe = new Stripe(key, { apiVersion: '2023-10-16' })
  _stripeByMode[mode] = stripe
  return stripe
}

function modeFromRequest(req: Request): StripeMode {
  return req.headers.get('x-stripe-mode') === 'test' ? 'test' : 'live'
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stripe-mode',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' })

  try {
    const body = await req.json().catch(() => null)
    const orderId = body?.order_id as string | undefined
    if (!orderId) return json(400, { error: 'order_id is required' })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Authn — only the buyer can cancel their own pending order.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json(401, { error: 'Missing authorization' })
    }
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return json(401, { error: 'Invalid authorization' })

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, buyer_id, status, buyer_transfer_id, stripe_payment_intent_id, wallet_applied_gbp')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) return json(404, { error: 'Order not found' })
    if (order.buyer_id !== user.id) return json(403, { error: 'Not your order' })

    // Idempotent: already terminal (paid/cancelled/shipped/etc.) — nothing to do.
    if (order.status !== 'payment_pending') {
      return json(200, {
        order_id: order.id,
        status: order.status,
        rolled_back: false,
        reason: 'order_already_terminal',
      })
    }

    const stripe = getStripe(modeFromRequest(req))

    // 1. Refund the wallet portion if any was captured.
    let walletRefundId: string | null = null
    if (order.buyer_transfer_id) {
      try {
        const refund = await stripe.refunds.create({
          charge: order.buyer_transfer_id,
          reason: 'requested_by_customer',
          metadata: { order_id: order.id, reason: 'client_payment_sheet_failed' },
        })
        walletRefundId = refund.id
        console.log('🔄 Refunded wallet charge for order', order.id, '→', refund.id)
      } catch (refundErr) {
        // Surface but don't block — log loudly so it can be reconciled by hand.
        console.error(
          '⚠️ Wallet refund FAILED for order',
          order.id,
          'charge',
          order.buyer_transfer_id,
          refundErr,
        )
      }
    }

    // 2. Cancel the stranded PaymentIntent so it doesn't sit in
    //    `requires_payment_method` for 24h before Stripe auto-expires it.
    if (order.stripe_payment_intent_id) {
      try {
        await stripe.paymentIntents.cancel(order.stripe_payment_intent_id, {
          cancellation_reason: 'abandoned',
        })
      } catch (piErr) {
        // PI may already be cancelled/succeeded/something — non-fatal.
        console.warn('PI cancel non-fatal error for order', order.id, piErr)
      }
    }

    // 3. Mark order cancelled.
    await supabase
      .from('orders')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', order.id)
      .eq('status', 'payment_pending') // CAS guard against webhook race

    return json(200, {
      order_id: order.id,
      status: 'cancelled',
      rolled_back: true,
      wallet_refund_id: walletRefundId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('cancel-order-payment error:', err)
    return json(500, { error: message })
  }
})
