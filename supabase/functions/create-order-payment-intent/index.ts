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
import { trackServerEvent } from '../_shared/analytics.ts'
import {
  computeBundlePricing,
  platformFeeFor,
  type BundlePricingResult,
  type PricingMode,
} from '../_shared/bundlePricing.ts'

// Lazy Stripe init — validation/stale-item paths return without touching
// Stripe, so the function still runs cleanly even when STRIPE_SECRET_KEY is
// missing on the project (e.g. fresh staging environment).
//
// Mode switching:
//   - Web checkout: no mode header → live (STRIPE_SECRET_KEY)
//   - iOS/Android dev builds: send `x-stripe-mode: test` → test
//     (STRIPE_TEST_SECRET_KEY). The PI gets metadata.mode='test' so the
//     stripe-webhook handler downstream can pick the right Stripe instance.
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
// Note: the per-item platform fee rule (£1 flat under £5, 20% at/over £5)
// now lives in _shared/bundlePricing.ts as platformFeeFor(gbp) — used
// both for bundled and non-bundled items via effectivePriceFor() below.
// The PLATFORM_FEE_* constants above are kept for reference only.

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

  const stripeMode = modeFromRequest(req)
  const stripe = () => getStripe(stripeMode)

  try {
    const body = await req.json().catch(() => null)
    if (!body) return badRequest('Invalid JSON body')

    const {
      listingIds,
      bundleIds,
      shippingAddress,
      buyerEmail,
      firstName,
      lastName,
      username,
      password,
      applyWallet,
    } = body as {
      listingIds?: unknown
      // Optional: client hint that these bundles' member listings are
      // all present in the basket and should receive their bundle
      // discount. The server REVALIDATES — if any member is missing
      // or the bundle is no longer active, the discount is silently
      // dropped and those items are charged at full price (per the
      // 2026-06-09 design: "If the buyer removes one item, the
      // discount silently drops off").
      bundleIds?: unknown
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
    // bundleIds is optional; if present must be a clean integer array.
    const validBundleIds: number[] = []
    if (bundleIds !== undefined && bundleIds !== null) {
      if (
        !Array.isArray(bundleIds) ||
        !bundleIds.every((id) => Number.isInteger(id) && (id as number) > 0)
      ) {
        return badRequest('bundleIds, if provided, must be an array of positive integers')
      }
      // Dedupe — a bundle is at most once per order.
      for (const id of bundleIds as number[]) {
        if (!validBundleIds.includes(id)) validBundleIds.push(id)
      }
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

    // ----- resolve bundles (server-side revalidation) -----
    // For each client-supplied bundleId we re-verify:
    //   1. The bundle exists, is owned by this seller, and is status='active'.
    //   2. Every member listing_id is present in this order's listingIds.
    // Failed bundles are silently dropped — the items charge at full price.
    // Per-listing maps capture the bundle context so we can write
    // order_items.bundle_id / original_price_gbp / bundle_discount_gbp.
    //
    // (The DB has an `archive_bundles_for_listing` trigger that flips
    // bundles to archived the moment a member listing leaves active.
    // We still recheck here because there's a small race window between
    // the buyer adding the bundle and submitting the order.)
    type ResolvedBundle = {
      bundleId: number
      pricingMode: PricingMode
      discountPct: number | null
      priceGbp: number | null
      pricing: BundlePricingResult
    }
    const resolvedBundles: ResolvedBundle[] = []
    const bundleIdByListing = new Map<number, number>()
    const originalPriceByListing = new Map<number, number>()
    const bundleDiscountByListing = new Map<number, number>()
    const effectivePriceByListing = new Map<number, number>()

    if (validBundleIds.length > 0) {
      const { data: bundleRows, error: bundleErr } = await supabase
        .from('bundles')
        .select(`
          id,
          seller_id,
          pricing_mode,
          discount_pct,
          price_gbp,
          status,
          bundle_items ( listing_id )
        `)
        .in('id', validBundleIds)

      if (bundleErr) {
        console.error('Bundle fetch failed:', bundleErr)
        return serverError('Could not load bundles')
      }

      const listingIdSet = new Set(activeListings.map((l) => l.id))
      const priceByListingId = new Map(activeListings.map((l) => [l.id, Number(l.asking_price_gbp)]))

      for (const b of (bundleRows ?? []) as Array<{
        id: number
        seller_id: string
        pricing_mode: PricingMode
        discount_pct: number | null
        price_gbp: number | null
        status: string
        bundle_items: Array<{ listing_id: number }>
      }>) {
        // Reject silently — bundle no longer applies, items charge full price.
        if (b.seller_id !== sellerId) continue
        if (b.status !== 'active') continue
        const memberIds = b.bundle_items.map((it) => it.listing_id)
        if (memberIds.length < 2) continue
        const allPresent = memberIds.every((id) => listingIdSet.has(id))
        if (!allPresent) continue

        // Guard: a single listing must not appear in two applied bundles
        // (would double-discount). First bundle wins; later bundle dropped.
        if (memberIds.some((id) => bundleIdByListing.has(id))) {
          console.warn(`Bundle ${b.id} overlaps with an earlier applied bundle; dropping`)
          continue
        }

        const memberListings = memberIds.map((id) => ({
          listingId: id,
          askingPriceGbp: priceByListingId.get(id) ?? 0,
        }))
        const pricing = computeBundlePricing({
          listings: memberListings,
          pricingMode: b.pricing_mode,
          discountPct: b.discount_pct ?? undefined,
          priceGbp: b.price_gbp != null ? Number(b.price_gbp) : undefined,
        })

        resolvedBundles.push({
          bundleId: b.id,
          pricingMode: b.pricing_mode,
          discountPct: b.discount_pct,
          priceGbp: b.price_gbp != null ? Number(b.price_gbp) : null,
          pricing,
        })

        for (const line of pricing.lines) {
          bundleIdByListing.set(line.listingId, b.id)
          originalPriceByListing.set(line.listingId, line.originalPriceGbp)
          bundleDiscountByListing.set(line.listingId, line.discountGbp)
          effectivePriceByListing.set(line.listingId, line.effectivePriceGbp)
        }
      }
    }

    // ----- compute money + weight -----
    // Effective price for fee/payout calc: bundle items use their
    // allocated share; non-bundle items use their asking price.
    function effectivePriceFor(l: { id: number; asking_price_gbp: number }): number {
      const fromBundle = effectivePriceByListing.get(l.id)
      return fromBundle != null ? fromBundle : Number(l.asking_price_gbp)
    }

    const subtotalGbp = round2(
      activeListings.reduce((sum, l) => sum + effectivePriceFor(l), 0),
    )
    const weightG =
      activeListings.reduce((sum, l) => sum + weightForFormat(l.format), 0) + PACKAGING_G

    if (weightG > HARD_CAP_WEIGHT_G) {
      return badRequest(
        `Basket weight ${(weightG / 1000).toFixed(1)}kg exceeds our 10kg per-order limit`,
      )
    }

    const parcelTier = parcelTierForWeight(weightG)
    // Free shipping uses what the BUYER PAYS (post-discount), per the
    // 2026-06-09 fee sign-off. An aggressive bundle discount can pull
    // the order under £10 and the buyer correctly pays shipping.
    const shippingGbp = subtotalGbp >= FREE_SHIPPING_THRESHOLD_GBP ? 0 : SHIPPING_FLAT_GBP
    const totalGbp = subtotalGbp + shippingGbp

    // Per-book platform fee on EFFECTIVE post-discount price.
    // Uses platformFeeFor() from _shared/bundlePricing.ts so the rule
    // (£1 flat under £5, 20% at/over £5) is defined in one place across
    // the three bundlePricing copies.
    const platformFeeGbp = round2(
      activeListings.reduce((sum, l) => sum + platformFeeFor(effectivePriceFor(l)), 0),
    )
    const sellerPayoutGbp = round2(subtotalGbp - platformFeeGbp)

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
          const balance = await stripe().balance.retrieve({
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
      const effective = effectivePriceFor(l)
      const fee = platformFeeFor(effective)
      const bundleId = bundleIdByListing.get(l.id) ?? null
      const inBundle = bundleId !== null
      return {
        order_id: order.id,
        listing_id: l.id,
        title: l.title,
        author: l.author,
        isbn: l.isbn,
        format: l.format,
        // price_gbp = effective sale price (what fees/payout are computed
        // on). For non-bundle items this equals asking_price; for bundle
        // items it's the discounted share.
        price_gbp: round2(effective),
        platform_fee_gbp: round2(fee),
        seller_payout_gbp: round2(effective - fee),
        weight_grams: weightForFormat(l.format),
        // Bundle context (slice 6). Nulls for non-bundle items.
        bundle_id: bundleId,
        original_price_gbp: inBundle
          ? round2(originalPriceByListing.get(l.id) ?? Number(l.asking_price_gbp))
          : round2(Number(l.asking_price_gbp)),
        bundle_discount_gbp: inBundle
          ? round2(bundleDiscountByListing.get(l.id) ?? 0)
          : 0,
      }
    })

    const { error: itemsErr } = await supabase.from('order_items').insert(orderItems)
    if (itemsErr) {
      console.error('Order items insert failed; rolling back order:', itemsErr)
      await supabase.from('orders').delete().eq('id', order.id)
      return serverError('Failed to create order items')
    }

    // ----- analytics: order_created -----
    await trackServerEvent({
      supabase,
      eventName: 'order_created',
      sellerId,
      userId: buyerId,
      properties: {
        order_id: order.id,
        seller_username: null, // resolved client-side or via join in analysis
        total_gbp: round2(totalGbp),
        subtotal_gbp: round2(subtotalGbp),
        shipping_gbp: round2(shippingGbp),
        wallet_applied_gbp: round2(walletAppliedGbp),
        card_charged_gbp: round2(cardChargedGbp),
        platform_fee_gbp: round2(platformFeeGbp),
        parcel_tier: parcelTier,
        item_count: activeListings.length,
        is_guest: !buyerId,
        estimated_weight_grams: weightG,
      },
    })

    // ----- wallet debit (Stripe Connect account charge) — for wallet-only AND mixed -----
    let buyerTransferId: string | null = null
    if (walletAppliedGbp > 0 && buyerStripeAccountId) {
      try {
        const walletPence = Math.round(walletAppliedGbp * 100)
        const buyerCharge = await stripe().charges.create({
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
          const transfer = await stripe().transfers.create({
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
      paymentIntent = await stripe().paymentIntents.create({
        amount: cardPence,
        currency: 'gbp',
        automatic_payment_methods: { enabled: true },
        transfer_data: { destination: sellerWallet.stripe_account_id },
        application_fee_amount: applicationFeePence,
        metadata: {
          order_id: order.id,
          type: 'multi_item_order',
          checkout_session_id: checkoutSessionId ?? '',
          platform: stripeMode === 'test' ? 'mobile_test' : 'web',
          mode: stripeMode,
        },
      })
    } catch (piErr) {
      // Roll back: the order hasn't been paid and never will be on this attempt.
      // CRITICAL: if a wallet charge was already captured above, refund it
      // here — otherwise the buyer's Connect balance is stranded with
      // nothing to show for it.
      console.error('PaymentIntent creation failed; cancelling order:', piErr)
      if (buyerTransferId) {
        try {
          await stripe().refunds.create({
            charge: buyerTransferId,
            reason: 'requested_by_customer',
            metadata: { order_id: order.id, reason: 'pi_creation_failed' },
          })
          console.log('🔄 Refunded stranded wallet charge:', buyerTransferId)
        } catch (refundErr) {
          // Log loud and proud — support will need to reconcile manually
          // if Stripe refund itself fails.
          console.error(
            '⚠️ Wallet refund FAILED after PI creation error. Manual reconciliation needed for charge',
            buyerTransferId,
            refundErr,
          )
        }
      }
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
