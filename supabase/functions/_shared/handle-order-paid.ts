// Shared post-payment handler for multi-item orders. Called from:
//   - create-order-payment-intent (wallet-only path, in-process, no Stripe webhook)
//   - stripe-webhook (card / mixed path, after payment_intent.succeeded)
//
// Idempotent: re-running on an already-paid order is a no-op.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { computeBadgeTotal, getPushTokens, sendExpoPush } from './expo-push.ts'
import { trackServerEvent } from './analytics.ts'

export type HandleOrderPaidArgs = {
  supabase: SupabaseClient
  orderId: string
  stripeChargeId?: string | null
  stripeTransferId?: string | null
}

export type HandleOrderPaidResult =
  | { ok: true; order: Record<string, unknown>; alreadyPaid: boolean }
  | { ok: false; error: string }

export async function handleOrderPaid(
  args: HandleOrderPaidArgs,
): Promise<HandleOrderPaidResult> {
  const { supabase, orderId, stripeChargeId, stripeTransferId } = args

  // 1. Fetch order
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (fetchErr || !order) {
    return { ok: false, error: `Order ${orderId} not found` }
  }

  // Idempotency: re-entering on an already-paid order is a no-op
  if (order.status !== 'payment_pending') {
    console.log(`Order ${orderId} already in status ${order.status}, skipping post-payment`)
    return { ok: true, order, alreadyPaid: true }
  }

  // 2. Resolve guest buyer if needed
  let buyerId: string | null = order.buyer_id
  if (!buyerId && order.checkout_session_id) {
    buyerId = await resolveGuestBuyer(supabase, order.checkout_session_id)
  }

  // 3. Mark order paid (optimistic lock on status to prevent double-processing)
  const updates: Record<string, unknown> = {
    status: 'paid',
    paid_at: new Date().toISOString(),
  }
  if (buyerId && !order.buyer_id) updates.buyer_id = buyerId
  if (stripeChargeId) updates.stripe_charge_id = stripeChargeId
  if (stripeTransferId) updates.stripe_transfer_id = stripeTransferId

  const { error: updateErr } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .eq('status', 'payment_pending')

  if (updateErr) {
    console.error('Order paid update failed:', updateErr)
    return { ok: false, error: 'Failed to mark order paid' }
  }

  // 4. Load items for downstream work
  const { data: items } = await supabase
    .from('order_items')
    .select('listing_id, title, price_gbp')
    .eq('order_id', orderId)

  const listingIds = (items ?? []).map((i: { listing_id: number }) => i.listing_id)

  // 5. Mark all listings sold (atomic via IN clause). Only flip rows that
  //    are still active — if another flow already sold one (race), leave it.
  if (listingIds.length > 0) {
    const { error: listingErr } = await supabase
      .from('listings')
      .update({ status: 'sold', sold_at: new Date().toISOString() })
      .in('id', listingIds)
      .eq('status', 'active')
    if (listingErr) {
      console.error('Listing sold update failed:', listingErr)
      // Continue — order is paid, this is a best-effort sync
    }
  }

  // 6. Increment seller wallet cache (best-effort; the RPC doesn't exist on
  //    prod and the existing single-item webhook silently catches the same
  //    failure. Kept here so when the RPC is created, it'll start working.)
  if (Number(order.seller_payout_gbp) > 0) {
    const { error: rpcErr } = await supabase.rpc('increment_seller_earnings', {
      p_user_id: order.seller_id,
      p_amount: order.seller_payout_gbp,
    })
    if (rpcErr) {
      console.log('Wallet update skipped (RPC may not exist):', rpcErr.message)
    }
  }

  // 7. System message in the buyer↔seller conversation (one per order, not per item)
  if (buyerId) {
    await insertPurchaseSystemMessage(supabase, {
      buyerId,
      sellerId: order.seller_id,
      orderId,
      totalGbp: Number(order.total_gbp),
      items: (items ?? []) as Array<{ listing_id: number; title: string; price_gbp: number }>,
    })
  }

  // 8. Notifications — emails + push.
  await fireOrderConfirmationNotifications(supabase, orderId).catch((err) => {
    console.error('Notification fan-out failed (non-fatal):', err)
  })

  // 9. Analytics: order_paid (covers both webhook and wallet-only paths)
  const paidAt = Date.now()
  const createdAt = order.created_at ? new Date(order.created_at as string).getTime() : paidAt
  await trackServerEvent({
    supabase,
    eventName: 'order_paid',
    sellerId: order.seller_id,
    userId: buyerId,
    properties: {
      order_id: orderId,
      total_gbp: Number(order.total_gbp),
      item_count: (items ?? []).length,
      is_guest: !buyerId && !!order.checkout_session_id,
      time_to_pay_seconds: Math.round((paidAt - createdAt) / 1000),
      paid_via: stripeChargeId ? 'card' : 'wallet',
    },
  })

  // Refetch the updated order so callers see current state
  const { data: finalOrder } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  return { ok: true, order: finalOrder ?? order, alreadyPaid: false }
}

// ----- helpers -----

async function resolveGuestBuyer(
  supabase: SupabaseClient,
  checkoutSessionId: string,
): Promise<string | null> {
  const { data: session } = await supabase
    .from('temp_checkout_sessions')
    .select('*')
    .eq('id', checkoutSessionId)
    .is('used_at', null)
    .maybeSingle()

  if (!session) {
    console.warn(`Checkout session ${checkoutSessionId} not found or already used`)
    return null
  }

  let resolvedId: string | null = null

  if (session.is_existing_user && session.existing_user_id) {
    resolvedId = session.existing_user_id
  } else {
    // Create new auth user (mirrors single-item flow: password column stores
    // the plaintext the buyer typed at checkout; passing it through to
    // auth.admin.createUser as `password` is the existing pattern).
    const { data: newUser, error: createErr } =
      await (supabase.auth as unknown as {
        admin: {
          createUser: (args: { email: string; password: string; email_confirm: boolean }) => Promise<{
            data: { user: { id: string } | null }
            error: { message?: string; code?: string } | null
          }>
          listUsers: (args: { page: number; perPage: number }) => Promise<{
            data: { users: Array<{ email?: string; id: string }> } | null
          }>
        }
      }).admin.createUser({
        email: session.email,
        password: session.password_hash,
        email_confirm: true,
      })

    if (createErr) {
      if (
        createErr.message?.toLowerCase().includes('already') ||
        createErr.code === 'email_address_already_exists'
      ) {
        // Race — user was created between our pre-check and now. Look up.
        const { data: existingProfile } = await supabase
          .from('users')
          .select('id')
          .eq('email', session.email)
          .maybeSingle()
        resolvedId = existingProfile?.id ?? null
      } else {
        console.error('Failed to create buyer auth user:', createErr)
      }
    } else if (newUser?.user?.id) {
      resolvedId = newUser.user.id

      // Ensure a public.users row exists
      const { data: existingProfile } = await supabase
        .from('users')
        .select('id')
        .eq('id', resolvedId)
        .maybeSingle()

      if (!existingProfile) {
        await supabase.from('users').insert({
          id: resolvedId,
          email: session.email,
          username: session.username || null,
          first_name: session.first_name || null,
          last_name: session.last_name || null,
          is_anonymous: false,
          registered_at: new Date().toISOString(),
        })
      }
    }
  }

  // Burn the session
  await supabase
    .from('temp_checkout_sessions')
    .update({ used_at: new Date().toISOString(), password_hash: '***' })
    .eq('id', checkoutSessionId)

  return resolvedId
}

async function insertPurchaseSystemMessage(
  supabase: SupabaseClient,
  args: {
    buyerId: string
    sellerId: string
    orderId: string
    totalGbp: number
    items: Array<{ listing_id: number; title: string; price_gbp: number }>
  },
): Promise<void> {
  try {
    // Conversations are keyed by listing_id in the existing schema. For
    // multi-item orders we pin the conversation to the first item's listing
    // — pragmatic approximation until a more general buyer↔seller
    // conversation surface lands.
    const firstListingId = args.items[0]?.listing_id
    if (!firstListingId) return

    let { data: convo } = await supabase
      .from('conversations')
      .select('id')
      .eq('listing_id', firstListingId)
      .eq('buyer_id', args.buyerId)
      .eq('seller_id', args.sellerId)
      .maybeSingle()

    if (!convo) {
      const { data: newConvo } = await supabase
        .from('conversations')
        .insert({
          listing_id: firstListingId,
          buyer_id: args.buyerId,
          seller_id: args.sellerId,
        })
        .select()
        .single()
      convo = newConvo
    }

    if (!convo) return

    const count = args.items.length
    const titles = args.items.map((i) => i.title).filter(Boolean).join(', ')
    let content = `Purchased ${count} ${count === 1 ? 'book' : 'books'} for £${args.totalGbp.toFixed(2)} — ${titles}`
    if (content.length > 200) content = content.slice(0, 197) + '…'

    await supabase.from('messages').insert({
      conversation_id: convo.id,
      sender_id: args.buyerId,
      content,
      message_type: 'system',
      event: 'purchase',
      is_read: false,
    })
  } catch (err) {
    console.error('System message insert failed:', err)
  }
}

async function fireOrderConfirmationNotifications(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  // Fetch everything we need for both emails in parallel.
  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, total_gbp, subtotal_gbp, shipping_gbp, wallet_applied_gbp,
      card_charged_gbp, platform_fee_gbp, seller_payout_gbp, parcel_tier,
      shipping_address, buyer_id, buyer_email, seller_id
    `)
    .eq('id', orderId)
    .single()

  if (!order) {
    console.warn('Could not load order for notification fan-out:', orderId)
    return
  }

  const { data: items } = await supabase
    .from('order_items')
    .select(
      'listing_id, title, author, price_gbp, platform_fee_gbp, seller_payout_gbp, bundle_id, original_price_gbp, bundle_discount_gbp',
    )
    .eq('order_id', orderId)

  const itemRows = items ?? []

  // Bundle context: load the bundle names for any bundle_id present
  // in this order's items, so emails can render "Bundle: «name»"
  // headings instead of opaque ids. One query, two rows max in
  // practice — we'd be amazed to see ≥ 3 bundles in a single order.
  const bundleIds = Array.from(
    new Set(
      itemRows
        .map((it: { bundle_id: number | null }) => it.bundle_id)
        .filter((id): id is number => id !== null && id !== undefined),
    ),
  )
  let bundleNamesById: Record<string, string> = {}
  if (bundleIds.length > 0) {
    const { data: bundleNameRows } = await supabase
      .from('bundles')
      .select('id, name')
      .in('id', bundleIds)
    bundleNamesById = Object.fromEntries(
      (bundleNameRows ?? []).map((b: { id: number; name: string }) => [String(b.id), b.name]),
    )
  }
  // Total bundle discount across the whole order — used in copy for
  // "You saved £X with bundles" lines.
  const totalBundleDiscountGbp = itemRows.reduce(
    (sum: number, it: { bundle_discount_gbp: number | null }) =>
      sum + Number(it.bundle_discount_gbp ?? 0),
    0,
  )

  const { data: seller } = await supabase
    .from('users')
    .select('id, email, first_name, username')
    .eq('id', order.seller_id)
    .single()

  // Buyer profile — only present if the auth user was successfully created
  let buyerProfile: { email?: string | null; first_name?: string | null; username?: string | null } | null = null
  if (order.buyer_id) {
    const { data } = await supabase
      .from('users')
      .select('email, first_name, username')
      .eq('id', order.buyer_id)
      .maybeSingle()
    buyerProfile = data
  }

  const buyerEmail = buyerProfile?.email ?? order.buyer_email
  const buyerName = buyerProfile?.first_name || buyerProfile?.username || 'there'
  const sellerEmail = seller?.email
  const sellerName = seller?.first_name || seller?.username || 'there'
  const sellerUsername = seller?.username

  const supabaseUrl = (Deno as unknown as { env: { get: (k: string) => string | undefined } }).env.get('SUPABASE_URL')
  const serviceKey = (Deno as unknown as { env: { get: (k: string) => string | undefined } }).env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    console.warn('Missing env for send-email call; skipping fan-out')
    return
  }

  const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`

  // ----- buyer: order_confirmation -----
  if (buyerEmail) {
    try {
      await fetch(sendEmailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          type: 'order_confirmation',
          to: buyerEmail,
          data: {
            buyerName,
            sellerUsername: sellerUsername ?? undefined,
            items: itemRows.map((it: {
              title: string
              author: string | null
              price_gbp: number
              bundle_id: number | null
              original_price_gbp: number | null
              bundle_discount_gbp: number | null
            }) => ({
              title: it.title,
              author: it.author,
              priceGbp: Number(it.price_gbp),
              // Bundle context (slice 7) — buyer email shows "−£X bundle"
              // on bundled lines so the discount is legible per item.
              bundleId: it.bundle_id ?? null,
              bundleName: it.bundle_id ? bundleNamesById[String(it.bundle_id)] ?? null : null,
              originalPriceGbp: it.original_price_gbp != null ? Number(it.original_price_gbp) : null,
              bundleDiscountGbp: it.bundle_discount_gbp != null ? Number(it.bundle_discount_gbp) : null,
            })),
            subtotalGbp: Number(order.subtotal_gbp),
            shippingGbp: Number(order.shipping_gbp),
            totalGbp: Number(order.total_gbp),
            walletAppliedGbp: Number(order.wallet_applied_gbp),
            cardChargedGbp: Number(order.card_charged_gbp),
            shippingAddress: order.shipping_address as Record<string, string> | null,
            estimatedDeliveryDays: '2-3 working days',
            orderId,
            // Aggregate so the email can render a "You saved £X with
            // bundles" line at the bottom of the totals without
            // re-summing client-side.
            bundleSavingsGbp: totalBundleDiscountGbp > 0 ? totalBundleDiscountGbp : null,
          },
        }),
      })
    } catch (err) {
      console.error('order_confirmation email failed:', err)
    }
  }

  // ----- seller: new_sale -----
  if (sellerEmail) {
    try {
      await fetch(sendEmailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          type: 'new_sale',
          to: sellerEmail,
          data: {
            sellerName,
            buyerName: buyerProfile?.username || buyerName,
            sellerUsername: sellerUsername ?? undefined,
            items: itemRows.map((it: {
              title: string
              price_gbp: number
              platform_fee_gbp: number
              seller_payout_gbp: number
              bundle_id: number | null
              original_price_gbp: number | null
              bundle_discount_gbp: number | null
            }) => ({
              title: it.title,
              priceGbp: Number(it.price_gbp),
              platformFeeGbp: Number(it.platform_fee_gbp),
              payoutGbp: Number(it.seller_payout_gbp),
              // Bundle context (slice 7) — seller email shows "−£X bundle"
              // per line so the discount the seller chose is visible.
              bundleId: it.bundle_id ?? null,
              bundleName: it.bundle_id ? bundleNamesById[String(it.bundle_id)] ?? null : null,
              originalPriceGbp: it.original_price_gbp != null ? Number(it.original_price_gbp) : null,
              bundleDiscountGbp: it.bundle_discount_gbp != null ? Number(it.bundle_discount_gbp) : null,
            })),
            subtotalGbp: Number(order.subtotal_gbp),
            totalPlatformFeeGbp: Number(order.platform_fee_gbp),
            totalPayoutGbp: Number(order.seller_payout_gbp),
            parcelTier: order.parcel_tier as string | undefined,
            orderId,
            // The seller chose this discount; surface it back so they
            // can see exactly what they gave up in the volume bet.
            bundleDiscountGbp: totalBundleDiscountGbp > 0 ? totalBundleDiscountGbp : null,
          },
        }),
      })
    } catch (err) {
      console.error('new_sale email failed:', err)
    }
  }

  // ----- Expo push notifications (buyer + seller) -----
  const itemCount = itemRows.length
  const buyerHandle = buyerProfile?.username || buyerProfile?.first_name || 'A buyer'
  // Seller-facing push surfaces the PAYOUT (what hits the seller's
  // wallet) rather than the buyer-paid total. The previous copy said
  // "@buyer bought 2 books for £12.00" which buyers wrongly read as
  // their incoming money. Email + in-app OrderDetail already render
  // the payout — this brings the push into line. Worth doing standalone,
  // independent of the bundles feature.
  const payoutLabel = `£${Number(order.seller_payout_gbp).toFixed(2)}`

  const sellerTokens = await getPushTokens(supabase, order.seller_id)
  const buyerTokens = order.buyer_id ? await getPushTokens(supabase, order.buyer_id) : []

  const [sellerBadge, buyerBadge] = await Promise.all([
    sellerTokens.length > 0 ? computeBadgeTotal(supabase, order.seller_id) : Promise.resolve(0),
    order.buyer_id && buyerTokens.length > 0
      ? computeBadgeTotal(supabase, order.buyer_id)
      : Promise.resolve(0),
  ])

  // Bundle-aware push copy: single-bundle orders get a more specific
  // headline ("bought your X bundle") so the seller sees their bundle
  // actually working. Multi-bundle orders fall back to a generic
  // "books · You earn" since enumerating bundles in 100 chars is messy.
  const bundleIdsOnOrder = Array.from(
    new Set(
      itemRows
        .map((it: { bundle_id: number | null }) => it.bundle_id)
        .filter((id): id is number => id !== null && id !== undefined),
    ),
  )
  const sellerBody =
    bundleIdsOnOrder.length === 1
      ? `${buyerHandle} bought your ${bundleNamesById[String(bundleIdsOnOrder[0])] ?? 'bundle'} · You earn ${payoutLabel}`
      : `${buyerHandle} bought ${itemCount} ${itemCount === 1 ? 'book' : 'books'} · You earn ${payoutLabel}`

  const firstTitle = itemRows[0]?.title ?? 'a book'
  const buyerBody =
    itemCount === 1
      ? `Your copy of "${firstTitle}"${sellerUsername ? ` from @${sellerUsername}` : ''} is on the way`
      : `Your ${itemCount} books${sellerUsername ? ` from @${sellerUsername}` : ''} are on the way`

  const deepLinkData = { screen: 'Orders', orderId }

  const notifications = [
    ...sellerTokens.map((token) => ({
      to: token,
      title: 'You made a sale! 🎉',
      body: sellerBody,
      sound: 'default' as const,
      badge: sellerBadge,
      channelId: 'default',
      data: deepLinkData,
    })),
    ...buyerTokens.map((token) => ({
      to: token,
      title: 'Order confirmed ✓',
      body: buyerBody,
      sound: 'default' as const,
      badge: buyerBadge,
      channelId: 'default',
      data: deepLinkData,
    })),
  ]

  await sendExpoPush(notifications)
}
