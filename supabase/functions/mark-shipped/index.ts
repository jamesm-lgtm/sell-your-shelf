// mark-shipped
//
// Marks a sale as shipped. Accepts ONE of:
//   { transaction_id }  — legacy single-item iOS flow (writes to `transactions`)
//   { order_id }        — new multi-item flow (writes to `orders`)
//
// On success:
//   - status → 'shipped', shipped_at → now
//   - System message inserted into the buyer↔seller conversation
//     (event='shipped', one per order milestone — not per item)
//   - order_shipped email fired to buyer (legacy single-item or new
//     multi-item payload depending on which path)
//   - Expo push fired to buyer
//
// Idempotent at the data layer (re-running on an already-shipped record
// returns 200 with no side effects).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { computeBadgeTotal, getPushTokens, sendExpoPush } from '../_shared/expo-push.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const transactionId = body?.transaction_id as number | string | undefined
    const orderId = body?.order_id as string | undefined

    if (!transactionId && !orderId) {
      return json(400, { error: 'transaction_id or order_id is required' })
    }
    if (transactionId && orderId) {
      return json(400, { error: 'Provide exactly one of transaction_id or order_id' })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    if (orderId) return await markOrderShipped(supabase, orderId)
    return await markTransactionShipped(supabase, transactionId!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('mark-shipped error:', err)
    return json(500, { error: message })
  }
})

// ---------------------------------------------------------------------
// Multi-item orders path
// ---------------------------------------------------------------------

async function markOrderShipped(supabase: SupabaseClient, orderId: string): Promise<Response> {
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select(`
      id, status, buyer_id, buyer_email, seller_id,
      tracking_number, tracking_url, shipping_method,
      total_gbp,
      seller:seller_id(first_name, username, email),
      buyer:buyer_id(first_name, username, email),
      items:order_items(id, listing_id, title, author)
    `)
    .eq('id', orderId)
    .single()

  if (fetchErr || !order) return json(404, { error: 'Order not found' })

  if (order.status === 'shipped' || order.status === 'delivered' || order.status === 'completed') {
    return json(200, { success: true, alreadyShipped: true })
  }
  if (order.status !== 'paid') {
    return json(400, { error: `Cannot mark as shipped: order status is ${order.status}` })
  }

  // Optimistic status update.
  const { error: updateErr } = await supabase
    .from('orders')
    .update({ status: 'shipped', shipped_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'paid')

  if (updateErr) {
    console.error('Order shipped update failed:', updateErr)
    return json(500, { error: 'Failed to mark order shipped' })
  }

  const buyer = (order as { buyer?: { first_name?: string | null; username?: string | null; email?: string | null } | null }).buyer ?? null
  const items = (order as { items?: Array<{ listing_id: number; title: string; author: string | null }> }).items ?? []

  const buyerName = buyer?.first_name || buyer?.username || 'there'
  const buyerEmail = buyer?.email ?? order.buyer_email
  const sellerId = order.seller_id as string

  // ----- system message (one per order milestone, event='shipped') -----
  try {
    const firstListingId = items[0]?.listing_id
    if (firstListingId && order.buyer_id) {
      const { data: convo } = await supabase
        .from('conversations')
        .select('id')
        .eq('listing_id', firstListingId)
        .eq('buyer_id', order.buyer_id)
        .eq('seller_id', sellerId)
        .maybeSingle()

      if (convo) {
        const content = order.tracking_number
          ? `Order shipped — tracking: ${order.tracking_number}`
          : 'Order shipped'
        await supabase.from('messages').insert({
          conversation_id: convo.id,
          sender_id: sellerId,
          content,
          message_type: 'system',
          event: 'shipped',
          is_read: false,
        })
      }
    }
  } catch (err) {
    console.error('Shipped system message insert failed:', err)
  }

  // ----- order_shipped email to buyer (multi-item payload) -----
  if (buyerEmail) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          type: 'order_shipped',
          to: buyerEmail,
          data: {
            buyerName,
            items: items.map((it) => ({ title: it.title, author: it.author })),
            trackingNumber: order.tracking_number,
            trackingUrl: order.tracking_url,
            estimatedDeliveryDays: '2-3 working days',
            orderId,
          },
        }),
      })
    } catch (err) {
      console.error('order_shipped email failed:', err)
    }
  }

  // ----- Expo push to buyer -----
  if (order.buyer_id) {
    const tokens = await getPushTokens(supabase, order.buyer_id)
    if (tokens.length > 0) {
      const badge = await computeBadgeTotal(supabase, order.buyer_id)
      const itemCount = items.length
      const body =
        itemCount === 1
          ? 'Your book is on the way'
          : `Your ${itemCount} books are on the way`
      await sendExpoPush(
        tokens.map((token) => ({
          to: token,
          title: 'Your order has shipped! 📦',
          body,
          sound: 'default' as const,
          badge,
          channelId: 'default',
          data: { screen: 'Orders', orderId },
        })),
      )
    }
  }

  return json(200, { success: true })
}

// ---------------------------------------------------------------------
// Legacy single-item transactions path (mirrors existing prod function)
// ---------------------------------------------------------------------

async function markTransactionShipped(
  supabase: SupabaseClient,
  transactionId: number | string,
): Promise<Response> {
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select(`
      *,
      buyer:buyer_id (id, name, email),
      listing:listing_id (title, author)
    `)
    .eq('id', transactionId)
    .single()

  if (txError || !transaction) return json(404, { error: 'Transaction not found' })

  if (
    transaction.status === 'shipped' ||
    transaction.status === 'delivered' ||
    transaction.status === 'completed'
  ) {
    return json(200, { success: true, alreadyShipped: true })
  }
  if (transaction.status !== 'paid') {
    return json(400, { error: `Cannot mark as shipped: status is ${transaction.status}` })
  }

  const { error: updateError } = await supabase
    .from('transactions')
    .update({ status: 'shipped', shipped_at: new Date().toISOString() })
    .eq('id', transactionId)
  if (updateError) throw updateError

  const buyerName = transaction.buyer?.name || 'there'
  const buyerEmail = transaction.buyer?.email
  const buyerId = transaction.buyer_id
  const sellerId = transaction.seller_id
  const bookTitle = transaction.listing?.title || 'Your book'
  const bookAuthor = transaction.listing?.author || ''
  const listingId = transaction.listing_id

  // System message
  try {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('listing_id', listingId)
      .eq('buyer_id', buyerId)
      .eq('seller_id', sellerId)
      .single()
    if (conversation) {
      const content = transaction.tracking_number
        ? `Order shipped! Track: ${transaction.tracking_number}`
        : 'Order shipped!'
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: sellerId,
        content,
        message_type: 'system',
        event: 'shipped',
        is_read: false,
      })
    }
  } catch (msgError) {
    console.log('System message insert failed:', msgError)
  }

  // Push
  if (buyerId) {
    const tokens = await getPushTokens(supabase, buyerId)
    if (tokens.length > 0) {
      const badge = await computeBadgeTotal(supabase, buyerId)
      await sendExpoPush(
        tokens.map((token) => ({
          to: token,
          title: 'Your book has shipped! 📦',
          body: `"${bookTitle}" is on its way to you`,
          sound: 'default' as const,
          badge,
          channelId: 'default',
          data: { screen: 'Orders' },
        })),
      )
    }
  }

  // Email (legacy single-item payload — send-email picks the right template)
  if (buyerEmail) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          type: 'order_shipped',
          to: buyerEmail,
          data: {
            buyerName,
            bookTitle,
            bookAuthor,
            trackingNumber: transaction.tracking_number,
            trackingUrl: transaction.shipping_tracking_url,
          },
        }),
      })
    } catch (emailError) {
      console.log('order_shipped email failed:', emailError)
    }
  }

  return json(200, { success: true })
}
