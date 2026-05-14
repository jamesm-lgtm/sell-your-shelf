// create-order-payment-intent
//
// Web-side multi-item checkout entry point. Creates an `orders` row in
// `payment_pending`, plus its `order_items`, and either:
//   (a) charges the buyer's Stripe Connect balance fully (wallet-only) and
//       hands off in-process to handleOrderPaid, OR
//   (b) returns a Stripe PaymentIntent client secret for the card portion.
//       In that case the stripe-webhook (multi-item branch) will invoke
//       handleOrderPaid when payment_intent.succeeded fires.
//
// Idempotency: none yet. Client-side debounce is responsible for not
// firing twice in rapid succession. A retry will create a duplicate
// payment_pending order. Acceptable for the launch — can revisit with
// Idempotency-Key once the surface is bigger.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17'
import { handleOrderPaid } from '../_shared/handle-order-paid.ts'

// Lazy Stripe init — validation/stale-item paths return without touching
// Stripe, so the function still runs cleanly even when STRIPE_SECRET_KEY is
// missing on the project (e.g. fresh staging environment).
let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured on this project')
  _stripe = new Stripe(key, { apiVersion: '2023-10-16' })
  return _stripe
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// ---------- pricing constants (mirror single-item flow) ----------
const PLATFORM_FEE_PERCENT = 20
const PLATFORM_FEE_FLAT_PENCE = 100 // £1
const PLATFORM_FEE_THRESHOLD_PENCE = 500 // £5

const SHIPPING_FLAT_GBP = 2.5 // Flat per Phase 1B Q1 — no medium/large tier yet
const FREE_SHIPPING_THRESHOLD_GBP = 10
const HARD_CAP_WEIGHT_G = 10_000

// Per-book weight heuristic (mirrors app/lib/basket.ts on the client)
const PACKAGING_G = 150
const WEIGHT_PAPERBACK_G = 280
const WEIGHT_HARDBACK_G = 800
const WEIGHT_UNKNOWN_G = 350

// ---------- CORS ----------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ---------- helpers ----------
function platformFeeForBookPence(pricePence: number): number {
  if (pricePence < PLATFORM_FEE_THRESHOLD_PENCE) return PLATFORM_FEE_FLAT_PENCE
  return Math.round(pricePence * (PLATFORM_FEE_PERCENT / 100))
}

function weightForFormat(format: string | null): number {
  if (format === 'paperback') return WEIGHT_PAPERBACK_G
  if (format === 'hardback') return WEIGHT_HARDBACK_G
  return WEIGHT_UNKNOWN_G
}

function parcelTierForWeight(weightG: number): 'small' | 'medium' | 'large' {
  if (weightG <= 2000) return 'small'
  if (weightG <= 5000) return 'medium'
  return 'large'
}

const round2 = (n: number) => Math.round(n * 100) / 100
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
const badRequest = (msg: string) => json(400, { error: msg })
const serverError = (msg: string) => json(500, { error: msg })

// ---------- handler ----------
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' })

  try {
    const body = await req.json().catch(() => null)
    if (!body) return badRequest('Invalid JSON body')

    const {
      listingIds,
      shippingAddress,
      buyerEmail,
      firstName,
      lastName,
      username,
      password,
      applyWallet,
    } = body as {
      listingIds?: unknown
      shippingAddress?: Record<string, unknown>
      buyerEmail?: string
      firstName?: string
      lastName?: string
      username?: string
      password?: string
      applyWallet?: boolean
    }

    // ----- input validation -----
    if (
      !Array.isArray(listingIds) ||
      listingIds.length === 0 ||
      !listingIds.every((id) => Number.isInteger(id) && (id as number) > 0)
    ) {
      return badRequest('listingIds must be a non-empty array of positive integers')
    }
    if (
      !shippingAddress ||
      typeof shippingAddress.name !== 'string' ||
      typeof shippingAddress.line1 !== 'string' ||
      typeof shippingAddress.city !== 'string' ||
      typeof shippingAddress.postcode !== 'string'
    ) {
      return badRequest('shippingAddress with name/line1/city/postcode is required')
    }
    if (!shippingAddress.country) shippingAddress.country = 'GB'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ----- buyer auth resolution (logged-in check only; guest session created later) -----
    let buyerId: string | null = null
    let buyerEmailResolved: string | null = null

    const authHeader = req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        buyerId = user.id
        buyerEmailResolved = user.email ?? null
      }
    }

    // Guest input validation (cheap; defer the actual insert until we know the
    // basket is good so we don't leak temp_checkout_sessions rows on failure).
    if (!buyerId) {
      if (!buyerEmail || typeof buyerEmail !== 'string') {
        return badRequest('buyerEmail is required for guest checkout')
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return badRequest('password (min 6 chars) is required for guest checkout')
      }
      buyerEmailResolved = buyerEmail
    }

    // ----- inventory recheck: listings exist, all active, all single-seller -----
    const { data: listings, error: listingsErr } = await supabase
      .from('listings')
      .select('id, title, author, asking_price_gbp, status, user_id, format, isbn')
      .in('id', listingIds as number[])

    if (listingsErr) {
      console.error('Listings fetch failed:', listingsErr)
      return serverError('Could not load listings')
    }

    const foundIds = new Set((listings ?? []).map((l: { id: number }) => l.id))
    const missingIds = (listingIds as number[]).filter((id) => !foundIds.has(id))
    const inactive = (listings ?? []).filter(
      (l: { status: string }) => l.status !== 'active',
    )

    if (missingIds.length > 0 || inactive.length > 0) {
      const stale = [
        ...missingIds.map((id) => ({ id, reason: 'removed' as const, title: null as string | null })),
        ...inactive.map((l: { id: number; status: string; title: string }) => ({
          id: l.id,
          reason: l.status,
          title: l.title,
        })),
      ]
      return json(409, {
        error: 'Some items are no longer available',
        stale_items: stale,
      })
    }

    const activeListings = listings as Array<{
      id: number
      title: string
      author: string | null
      asking_price_gbp: number
      user_id: string
      format: string | null
      isbn: string | null
    }>

    // Single-seller invariant
    const sellerIds = new Set(activeListings.map((l) => l.user_id))
    if (sellerIds.size !== 1) {
      return badRequest('Basket must contain items from a single seller only')
    }
    const sellerId = activeListings[0].user_id

    // No self-purchase
    if (buyerId === sellerId) return badRequest('Cannot buy your own listings')

    // ----- seller Connect status gate -----
    const { data: sellerWallet, error: sellerWalletErr } = await supabase
      .from('user_wallets')
      .select('stripe_account_id, stripe_account_status')
      .eq('user_id', sellerId)
      .maybeSingle()

    if (sellerWalletErr || !sellerWallet?.stripe_account_id) {
      return badRequest('Seller has not set up payments yet')
    }
    if (sellerWallet.stripe_account_status !== 'enabled') {
      return badRequest('Seller cannot accept payments yet')
    }

    // ----- guest checkout session (only created once basket+seller pass) -----
    let checkoutSessionId: string | null = null
    if (!buyerId) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', buyerEmail)
        .maybeSingle()

      // Self-purchase check for guests too (catches the edge case where
      // a seller tries to buy their own listing via the guest flow).
      if (existingUser?.id && existingUser.id === sellerId) {
        return badRequest('Cannot buy your own listings')
      }

      const { data: session, error: sessionErr } = await supabase
        .from('temp_checkout_sessions')
        .insert({
          email: buyerEmail,
          username: username || null,
          password_hash: password, // mirrors existing single-item flow; column name is misleading
          first_name: firstName || null,
          last_name: lastName || null,
          is_existing_user: !!existingUser,
          existing_user_id: existingUser?.id ?? null,
        })
        .select()
        .single()

      if (sessionErr || !session) {
        console.error('temp_checkout_sessions insert failed:', sessionErr)
        return serverError('Could not start checkout session')
      }
      checkoutSessionId = session.id
    }

    // ----- compute money + weight -----
    const subtotalGbp = activeListings.reduce(
      (sum, l) => sum + Number(l.asking_price_gbp),
      0,
    )
    const weightG =
      activeListings.reduce((sum, l) => sum + weightForFormat(l.format), 0) + PACKAGING_G

    if (weightG > HARD_CAP_WEIGHT_G) {
      return badRequest(
        `Basket weight ${(weightG / 1000).toFixed(1)}kg exceeds our 10kg per-order limit`,
      )
    }

    const parcelTier = parcelTierForWeight(weightG)
    const shippingGbp = subtotalGbp >= FREE_SHIPPING_THRESHOLD_GBP ? 0 : SHIPPING_FLAT_GBP
    const totalGbp = subtotalGbp + shippingGbp

    // Per-book platform fee (matches single-item rule: £1 flat under £5, else 20%)
    let platformFeePence = 0
    const itemFees = activeListings.map((l) => {
      const pricePence = Math.round(Number(l.asking_price_gbp) * 100)
      const feePence = platformFeeForBookPence(pricePence)
      platformFeePence += feePence
      return { listingId: l.id, feePence, payoutPence: pricePence - feePence }
    })
    const platformFeeGbp = platformFeePence / 100
    const sellerPayoutGbp = subtotalGbp - platformFeeGbp

    // ----- wallet handling (logged-in users with Connect balance) -----
    let walletAppliedGbp = 0
    let cardChargedGbp = totalGbp
    let buyerStripeAccountId: string | null = null

    if (applyWallet === true && buyerId) {
      const { data: buyerWallet } = await supabase
        .from('user_wallets')
        .select('stripe_account_id, stripe_account_status')
        .eq('user_id', buyerId)
        .maybeSingle()

      if (
        buyerWallet?.stripe_account_id &&
        buyerWallet.stripe_account_status === 'enabled'
      ) {
        buyerStripeAccountId = buyerWallet.stripe_account_id
        try {
          const balance = await getStripe().balance.retrieve({
            stripeAccount: buyerStripeAccountId,
          })
          const availablePence =
            balance.available.find((b) => b.currency === 'gbp')?.amount ?? 0
          const totalPence = Math.round(totalGbp * 100)
          const walletPence = Math.min(availablePence, totalPence)
          walletAppliedGbp = walletPence / 100
          cardChargedGbp = (totalPence - walletPence) / 100
        } catch (balErr) {
          console.warn('Stripe balance retrieve failed; falling back to card:', balErr)
        }
      }
    }

    // ----- create order + items (payment_pending) -----
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        buyer_id: buyerId,
        buyer_email: buyerEmailResolved,
        checkout_session_id: checkoutSessionId,
        seller_id: sellerId,
        status: 'payment_pending',
        subtotal_gbp: round2(subtotalGbp),
        shipping_gbp: round2(shippingGbp),
        total_gbp: round2(totalGbp),
        platform_fee_gbp: round2(platformFeeGbp),
        seller_payout_gbp: round2(sellerPayoutGbp),
        wallet_applied_gbp: round2(walletAppliedGbp),
        card_charged_gbp: round2(cardChargedGbp),
        shipping_address: shippingAddress,
        parcel_tier: parcelTier,
        estimated_weight_grams: weightG,
      })
      .select()
      .single()

    if (orderErr || !order) {
      console.error('Order insert failed:', orderErr)
      return serverError('Failed to create order')
    }

    const orderItems = activeListings.map((l) => {
      const pricePence = Math.round(Number(l.asking_price_gbp) * 100)
      const feePence = platformFeeForBookPence(pricePence)
      return {
        order_id: order.id,
        listing_id: l.id,
        title: l.title,
        author: l.author,
        isbn: l.isbn,
        format: l.format,
        price_gbp: round2(pricePence / 100),
        platform_fee_gbp: round2(feePence / 100),
        seller_payout_gbp: round2((pricePence - feePence) / 100),
        weight_grams: weightForFormat(l.format),
      }
    })

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems)
    if (itemsErr) {
      console.error('Order items insert failed; rolling back order:', itemsErr)
      await supabase.from('orders').delete().eq('id', order.id)
      return serverError('Failed to create order items')
    }

    // ----- wallet debit (Stripe Connect account charge) — for wallet-only AND mixed -----
    let buyerTransferId: string | null = null
    if (walletAppliedGbp > 0 && buyerStripeAccountId) {
      try {
        const walletPence = Math.round(walletAppliedGbp * 100)
        const buyerCharge = await getStripe().charges.create({
          amount: walletPence,
          currency: 'gbp',
          source: buyerStripeAccountId,
          description: `Order ${order.id}: ${activeListings.length} ${activeListings.length === 1 ? 'book' : 'books'}`,
        })
        buyerTransferId = buyerCharge.id
        await supabase
          .from('orders')
          .update({ buyer_transfer_id: buyerTransferId })
          .eq('id', order.id)
      } catch (walletErr) {
        const msg = walletErr instanceof Error ? walletErr.message : 'wallet debit failed'
        console.error('Wallet debit failed:', walletErr)
        await supabase
          .from('orders')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', order.id)
        return badRequest(`Wallet debit failed: ${msg}`)
      }
    }

    // ----- branch on wallet-only vs card-required -----
    if (cardChargedGbp === 0) {
      // Wallet-only: transfer seller's portion now and run the shared handler in-process.
      let sellerTransferId: string | null = null
      if (sellerPayoutGbp > 0) {
        try {
          const transfer = await getStripe().transfers.create({
            amount: Math.round(sellerPayoutGbp * 100),
            currency: 'gbp',
            destination: sellerWallet.stripe_account_id,
          })
          sellerTransferId = transfer.id
        } catch (transferErr) {
          console.error('Seller transfer failed on wallet-only order:', transferErr)
          // We've already debited the buyer's balance. Don't fail the
          // checkout — surface in logs and let support reconcile.
        }
      }

      const result = await handleOrderPaid({
        supabase,
        orderId: order.id,
        stripeChargeId: buyerTransferId,
        stripeTransferId: sellerTransferId,
      })

      if (!result.ok) {
        console.error('handleOrderPaid failed for wallet-only order:', result.error)
        return serverError(`Post-payment handling failed: ${result.error}`)
      }

      return json(200, {
        order_id: order.id,
        requires_payment: false,
        success: true,
      })
    }

    // Card payment required — create a destination-charge PaymentIntent.
    const cardPence = Math.round(cardChargedGbp * 100)
    const platformKeepsPence = Math.round((platformFeeGbp + shippingGbp) * 100)
    // Keep at least 1p flowing to seller so the Connect webhook still fires
    const applicationFeePence = Math.min(platformKeepsPence, Math.max(0, cardPence - 1))

    let paymentIntent
    try {
      paymentIntent = await getStripe().paymentIntents.create({
        amount: cardPence,
        currency: 'gbp',
        automatic_payment_methods: { enabled: true },
        transfer_data: { destination: sellerWallet.stripe_account_id },
        application_fee_amount: applicationFeePence,
        metadata: {
          order_id: order.id,
          type: 'multi_item_order',
          checkout_session_id: checkoutSessionId ?? '',
          platform: 'web',
        },
      })
    } catch (piErr) {
      // Roll back: the order hasn't been paid and never will be on this attempt.
      // Mark cancelled rather than DELETE so the record survives for audit. If
      // the buyer retries we'll create a fresh order anyway.
      console.error('PaymentIntent creation failed; cancelling order:', piErr)
      await supabase
        .from('orders')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', order.id)
      const msg = piErr instanceof Error ? piErr.message : 'Stripe PaymentIntent creation failed'
      return serverError(msg)
    }

    await supabase
      .from('orders')
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq('id', order.id)

    return json(200, {
      order_id: order.id,
      requires_payment: true,
      stripe_payment_intent_client_secret: paymentIntent.client_secret,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('create-order-payment-intent error:', err)
    return serverError(msg)
  }
})
