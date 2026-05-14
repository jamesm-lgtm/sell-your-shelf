// Shared post-payment handler for multi-item orders. Called from:
//   - create-order-payment-intent (wallet-only path, in-process, no Stripe webhook)
//   - stripe-webhook (card / mixed path, after payment_intent.succeeded)
//
// Idempotent: re-running on an already-paid order is a no-op.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  // Wired in Steps 5/6. For now we hand off to the (yet-to-be-written) helpers
  // and the existing stripe-webhook flow continues to handle single-item events.
  await fireOrderConfirmationNotifications(supabase, orderId).catch((err) => {
    console.error('Notification fan-out failed (non-fatal):', err)
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
  _supabase: SupabaseClient,
  _orderId: string,
): Promise<void> {
  // TODO Step 5 (emails) and Step 6 (push): fire order_confirmation email
  // to buyer, new_sale to seller, and the two push notifications.
  // Intentionally left as a no-op for Step 2 — the order is paid in the DB
  // and the system message lands; emails/pushes follow in Steps 5/6.
  return
}
